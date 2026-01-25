import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Alert } from 'react-native';
import { supabase } from '../services/supabase';

/**
 * Mostra um alerta de erro (compatível com Web e Mobile)
 */
function showErrorAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    // Na Web, usar window.alert como fallback
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Determina o MIME type baseado na extensão do arquivo
 */
function inferMimeType(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop() || '';
  
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Normaliza o nome do arquivo removendo caracteres inválidos
 */
function sanitizeFilename(filename: string): string {
  // Remove caracteres inválidos para nome de arquivo
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

/**
 * Obtém a URL assinada do Supabase Storage para um arquivo
 */
async function getSignedUrlFromStorage(storagePath: string, fallbackFilename?: string): Promise<string> {
  const BUCKET_NAME = 'documents';
  
  // Se já for uma URL, retornar diretamente
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath;
  }

  // Se for um arquivo local, retornar como está
  if (storagePath.startsWith('file://') || storagePath.startsWith('content://')) {
    return storagePath;
  }

  // Extrair o nome do arquivo do storage path
  let filename = storagePath;
  
  // Remover prefixo do bucket se presente
  if (storagePath.startsWith(`${BUCKET_NAME}/`)) {
    filename = storagePath.replace(`${BUCKET_NAME}/`, '');
  } else if (storagePath.includes('/')) {
    // Se tiver barras mas não começar com o nome do bucket, pegar a última parte
    const parts = storagePath.split('/');
    filename = parts[parts.length - 1];
  }

  // Remover barras e espaços em branco
  filename = filename.trim().replace(/^\/+|\/+$/g, '');

  if (!filename) {
    // Se não conseguiu extrair e tem fallback, usar fallback
    if (fallbackFilename) {
      filename = fallbackFilename;
    } else {
      return storagePath;
    }
  }
  
  // Se o filename não tem extensão mas temos um fallbackFilename com extensão, tentar usar
  if (!filename.includes('.') && fallbackFilename && fallbackFilename.includes('.')) {
    // Pode ser que o storagePath seja um UUID e o arquivo real tenha o nome do fallbackFilename
    // Tentar primeiro com o storagePath como está, se falhar tentar com fallbackFilename
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filename, 86400);
      
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch {
      // Continuar para tentar com fallbackFilename
    }
    
    // Tentar com fallbackFilename se o original não funcionou
    filename = fallbackFilename;
  }

  try {
    // Verificar se há uma sessão ativa antes de gerar a URL assinada
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('No active session found when trying to get signed URL');
      // Continuar mesmo assim - pode funcionar dependendo das políticas RLS
    }

    // Primeiro, tentar obter URL pública (se o bucket for público)
    try {
      const { data: publicData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filename);
      
      if (publicData?.publicUrl) {
        // Verificar se a URL pública funciona fazendo uma requisição HEAD
        try {
          const response = await fetch(publicData.publicUrl, { method: 'HEAD', cache: 'no-cache' });
          if (response.ok) {
            return publicData.publicUrl;
          }
        } catch (fetchError) {
          // Se não funcionar, continuar com signed URL
          console.log('Public URL not accessible, using signed URL');
        }
      }
    } catch (publicError) {
      // Se não funcionar, continuar com signed URL
      console.log('Public URL not available, using signed URL');
    }

    // Obter URL assinada do Supabase Storage (válida por 24 horas para evitar problemas de expiração)
    // Usar 86400 segundos = 24 horas
    const expiresIn = 86400; // 24 horas
    
    // Gerar a URL assinada imediatamente antes de usar
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filename, expiresIn);

    if (error) {
      console.error('Error getting signed URL:', error.message, 'filename:', filename);
      
      // Se falhou e temos um fallbackFilename diferente, tentar com ele
      if (fallbackFilename && fallbackFilename !== filename && fallbackFilename.includes('.')) {
        console.log('Trying with fallback filename:', fallbackFilename);
        try {
          const { data: fallbackData, error: fallbackError } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fallbackFilename, expiresIn);
          
          if (!fallbackError && fallbackData?.signedUrl) {
            return fallbackData.signedUrl;
          }
        } catch (fallbackErr) {
          console.error('Error with fallback filename:', fallbackErr);
        }
      }
      
      // Tentar novamente com tempo menor se falhar
      const { data: retryData, error: retryError } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filename, 3600);
      
      if (retryError) {
        // Se ainda falhar e temos fallbackFilename, tentar uma última vez
        if (fallbackFilename && fallbackFilename !== filename && fallbackFilename.includes('.')) {
          const { data: lastRetryData, error: lastRetryError } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fallbackFilename, 3600);
          
          if (!lastRetryError && lastRetryData?.signedUrl) {
            return lastRetryData.signedUrl;
          }
        }
        
        console.error('Error getting signed URL on retry:', retryError.message);
        throw new Error(`Não foi possível obter a URL do arquivo: ${retryError.message}`);
      }
      
      if (!retryData?.signedUrl) {
        throw new Error('URL assinada não foi retornada pelo Supabase');
      }
      
      return retryData.signedUrl;
    }

    if (!data?.signedUrl) {
      console.error('No signed URL returned from Supabase');
      throw new Error('URL assinada não foi retornada pelo Supabase');
    }

    return data.signedUrl;
  } catch (error: any) {
    console.error('Exception getting signed URL:', error?.message);
    throw error; // Re-throw para que o chamador possa tratar
  }
}

/**
 * Baixa um anexo remoto e abre com o app apropriado
 * 
 * @param remoteUrl URL remota (http/https) ou URI local (file:// ou content://)
 * @param filename Nome do arquivo para salvar
 * @param mimeType Tipo MIME opcional (será inferido por extensão se não fornecido)
 */
export async function downloadAndOpenAttachment(
  remoteUrl: string,
  filename: string,
  mimeType?: string
): Promise<void> {
  try {
    // Determinar MIME type se não fornecido
    const fileMimeType = mimeType || inferMimeType(filename);
    const sanitizedFilename = sanitizeFilename(filename);
    
    // Web: tratar primeiro - baixar arquivo diretamente
    if (Platform.OS === 'web') {
      // Baixar o arquivo diretamente para a pasta de downloads
      if (typeof window !== 'undefined') {
        try {
          // Extrair o nome do arquivo da URL se necessário
          let storagePathForRegeneration = remoteUrl;
          
          // Se remoteUrl já é uma URL completa (assinada), extrair o nome do arquivo dela
          if (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://')) {
            // Tentar extrair o nome do arquivo da URL assinada
            // Formato: .../sign/documents/FILENAME?token=...
            // Suporta: pdf, jpg, jpeg, png, gif, webp e outras extensões
            const match = remoteUrl.match(/\/([^\/]+\.(pdf|jpg|jpeg|png|gif|webp|bmp|tiff|svg))(\?|$)/i);
            if (match && match[1]) {
              // Usar apenas o nome do arquivo para regenerar
              storagePathForRegeneration = match[1];
            } else {
              // Se não conseguir extrair da URL expirada, usar o filename
              // O filename geralmente é o nome original do arquivo ou pode ter timestamp
              storagePathForRegeneration = filename || sanitizedFilename;
            }
          } else {
            // Se remoteUrl não é uma URL, pode ser:
            // 1. UUID simples (sem extensão) - tentar usar filename primeiro
            // 2. Nome de arquivo com timestamp (ex: 1769011344757_0035.pdf)
            // 3. Nome simples (ex: arquivo.pdf)
            
            // Se remoteUrl parece ser um UUID (sem pontos nem barras), usar filename
            if (!remoteUrl.includes('/') && !remoteUrl.includes('.')) {
              // É provavelmente um UUID ou ID, usar o filename original que deve ter o nome correto
              storagePathForRegeneration = filename || sanitizedFilename;
            } else {
              // Parece ser um nome de arquivo ou path, usar diretamente
              storagePathForRegeneration = remoteUrl;
            }
          }
          
          // Garantir que temos um nome válido - se storagePathForRegeneration ainda não tem extensão,
          // tentar adicionar baseado no filename ou mimeType
          if (storagePathForRegeneration && !storagePathForRegeneration.includes('.')) {
            // Se não tem extensão, tentar usar o filename que deve ter
            if (filename && filename.includes('.')) {
              storagePathForRegeneration = filename;
            } else if (sanitizedFilename && sanitizedFilename.includes('.')) {
              storagePathForRegeneration = sanitizedFilename;
            }
          }
          
          // SEMPRE gerar URL fresca imediatamente antes de usar
          // Isso garante que o token seja válido no momento do download
          // Passar filename como fallback caso storagePathForRegeneration não tenha extensão
          const urlToDownload = await getSignedUrlFromStorage(storagePathForRegeneration, filename || sanitizedFilename);
          
          // Verificar se obtivemos uma URL válida
          if (!urlToDownload || (!urlToDownload.startsWith('http://') && !urlToDownload.startsWith('https://'))) {
            showErrorAlert('Erro', 'Não foi possível obter a URL do arquivo. Verifique se o arquivo existe e se você tem permissão para acessá-lo.');
            return;
          }
          
          // Usar fetch para baixar o arquivo com URL fresca
          const response = await fetch(urlToDownload, {
            method: 'GET',
            headers: {
              'Accept': fileMimeType,
            },
          });
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            let errorMessage = `Erro ao baixar arquivo: ${response.status} ${response.statusText}`;
            
            // Tentar parse do erro JSON
            try {
              const jsonError = JSON.parse(errorText);
              if (jsonError.message) {
                errorMessage = jsonError.message;
              }
            } catch {
              // Não é JSON
            }
            
            throw new Error(errorMessage);
          }
          
          // Criar Blob e fazer download
          const blob = await response.blob();
          
          // Verificar se não é um erro JSON
          if (blob.type === 'application/json' || (blob.size < 100 && !fileMimeType.startsWith('image/'))) {
            const text = await blob.text();
            try {
              const jsonError = JSON.parse(text);
              if (jsonError.error || jsonError.statusCode) {
                throw new Error(`Erro do servidor: ${jsonError.message || jsonError.error || 'Token inválido'}`);
              }
            } catch {
              // Não é JSON de erro, continuar
            }
          }
          
          // Verificar se o blob está vazio (exceto para imagens muito pequenas)
          if (blob.size === 0 && !fileMimeType.startsWith('image/')) {
            throw new Error('Arquivo vazio recebido do servidor');
          }
          
          // Criar URL do blob e fazer download
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = sanitizedFilename;
          link.style.display = 'none';
          
          // Para imagens, também adicionar atributo para abrir em nova guia se necessário
          if (fileMimeType.startsWith('image/')) {
            link.setAttribute('target', '_blank');
          }
          
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
          }, 100);
          
        } catch (downloadError: any) {
          console.error('Error downloading file:', downloadError);
          showErrorAlert('Erro', `Não foi possível baixar o arquivo: ${downloadError?.message || 'Erro desconhecido'}`);
        }
      } else {
        throw new Error('Não foi possível baixar o arquivo no navegador');
      }
      return;
    }
    
    // Mobile: continuar com a lógica de download
    let localUri: string;
    
    // Se já for um arquivo local, usar diretamente
    if (remoteUrl.startsWith('file://') || remoteUrl.startsWith('content://')) {
      // Verificar se o arquivo existe
      try {
        const file = new File(remoteUrl);
        const fileInfo = await file.info();
        if (!fileInfo.exists) {
          Alert.alert('Erro', 'Arquivo não encontrado');
          return;
        }
      } catch (error) {
        console.warn('Could not verify local file existence:', error);
        // Continuar mesmo assim - pode ser um content:// URI válido
      }
      localUri = remoteUrl;
    } else if (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://')) {
      // É uma URL remota - baixar o arquivo
      
      // Criar diretório de anexos se não existir
      const attachmentsDir = new Directory(Paths.document, 'attachments');
      const dirInfo = await attachmentsDir.info();
      if (!dirInfo.exists) {
        await attachmentsDir.create();
      }
      
      // Criar referência ao arquivo local
      const localFile = new File(attachmentsDir, sanitizedFilename);
      
      // Verificar se o arquivo já existe localmente
      const fileInfo = await localFile.info();
      if (fileInfo.exists) {
        console.log('File already exists locally, using cached version');
        localUri = localFile.uri;
      } else {
        // Baixar o arquivo usando a nova API
        await File.downloadFileAsync(remoteUrl, localFile, { idempotent: true });
        localUri = localFile.uri;
      }
    } else {
      // Não reconhece o formato - assumir que é um path relativo e tentar tratar como file://
      localUri = remoteUrl.startsWith('/') ? `file://${remoteUrl}` : `file:///${remoteUrl}`;
      
      // Verificar se o arquivo existe
      try {
        const file = new File(localUri);
        const fileInfo = await file.info();
        if (!fileInfo.exists) {
          Alert.alert('Erro', 'Arquivo não encontrado');
          return;
        }
      } catch (error) {
        console.warn('Could not verify file existence:', error);
        Alert.alert('Erro', 'Não foi possível abrir o arquivo');
        return;
      }
    }
    
    // Abrir o arquivo com o app apropriado
    if (Platform.OS === 'android') {
      // Android: usar IntentLauncher com content URI
      try {
        // Para Android, precisamos converter file:// para content:// URI
        // getContentUriAsync só está disponível no legacy API
        const contentUri = await FileSystemLegacy.getContentUriAsync(localUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: fileMimeType,
        });
      } catch (error: any) {
        console.error('Error opening file with IntentLauncher:', error);
        
        // Fallback: tentar com Sharing se IntentLauncher falhar
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(localUri, { mimeType: fileMimeType });
        } else {
          throw new Error('Não foi possível abrir o arquivo');
        }
      }
    } else if (Platform.OS === 'ios') {
      // iOS: usar Sharing para abrir o chooser
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(localUri, { mimeType: fileMimeType });
      } else {
        throw new Error('Compartilhamento não está disponível neste dispositivo');
      }
    } else {
      // Outras plataformas - não suportado
      throw new Error('Abrir anexos não é suportado nesta plataforma');
    }
  } catch (error: any) {
    console.error('Error in downloadAndOpenAttachment:', error);
    
    // Mostrar mensagem de erro amigável
    const errorMessage = error?.message || 'Erro desconhecido';
    Alert.alert(
      'Erro',
      `Não foi possível abrir o arquivo: ${errorMessage}`,
      [{ text: 'OK' }]
    );
  }
}
