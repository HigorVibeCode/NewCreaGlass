import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Alert } from 'react-native';
import { supabase, clearSupabaseAuthStorage, isRefreshTokenError } from '../services/supabase';
import { getCachedSignedUrl } from './signed-url-cache';

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
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
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
export async function getSignedUrlFromStorage(storagePath: string, fallbackFilename?: string): Promise<string> {
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

  // Se o storagePath parece UUID (sem extensão) e temos fallback com extensão, usar fallback como primeiro candidato
  // para evitar request inútil; o arquivo no Storage costuma ser timestamp_nome.pdf
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filename);
  if (looksLikeUuid && fallbackFilename?.includes('.')) {
    filename = fallbackFilename;
  } else if (!filename.includes('.') && fallbackFilename && fallbackFilename.includes('.')) {
    try {
      const url = await getCachedSignedUrl(filename, 86400);
      if (url) return url;
    } catch {
      // ignorar
    }
    filename = fallbackFilename;
  }

  // Gerar variações do nome do arquivo para busca (espaços, underscores, URL-encoding)
  const filenameVariations: string[] = [filename];
  if (filename.includes(' ')) {
    filenameVariations.push(filename.replace(/\s+/g, '%20'));
    filenameVariations.push(filename.replace(/\s+/g, '_'));
  }
  if (filename.includes('_')) {
    filenameVariations.push(filename.replace(/_/g, ' '));
  }
  if (fallbackFilename && fallbackFilename !== filename) {
    filenameVariations.push(fallbackFilename);
    if (fallbackFilename.includes(' ')) {
      filenameVariations.push(fallbackFilename.replace(/\s+/g, '%20'));
      filenameVariations.push(fallbackFilename.replace(/\s+/g, '_'));
    }
  }
  // Remover duplicatas
  const uniqueVariations = [...new Set(filenameVariations)];

  try {
    // Verificar se há uma sessão ativa antes de gerar a URL assinada
    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    } catch (authErr: any) {
      if (isRefreshTokenError(authErr)) {
        await clearSupabaseAuthStorage();
      }
    }
    if (!session) {
      console.warn('No active session found when trying to get signed URL');
    }

    const expiresIn = 86400; // 24 horas

    // 1. Tentar todas as variações de nome de arquivo diretamente
    for (const variation of uniqueVariations) {
      try {
        const url = await getCachedSignedUrl(variation, expiresIn);
        if (url) {
          return url;
        }
      } catch {
        // Continuar tentando próxima variação
      }
    }

    console.log('[getSignedUrlFromStorage] Direct attempts failed, trying list search for:', filename);

    // 2. Listar bucket e buscar arquivo por nome parcial (handles timestamp prefixes)
    const searchName = (fallbackFilename || filename).trim();
    const searchNameUnderscore = searchName.replace(/\s+/g, '_');
    const searchNameEncoded = searchName.replace(/\s+/g, '%20');

    // Extrair extensão e nome base para busca mais flexível
    const extMatch = searchName.match(/\.([a-z0-9]+)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    const baseName = ext ? searchName.replace(/\.[^.]+$/, '') : searchName;
    const baseNameUnderscore = baseName.replace(/\s+/g, '_');

    const matchByName = (f: { name: string }) => {
      const n = f.name;
      return (
        n === searchName ||
        n === filename ||
        n === searchNameUnderscore ||
        n === searchNameEncoded ||
        n.endsWith('_' + searchName) ||
        n.endsWith('_' + searchNameUnderscore) ||
        n.endsWith('_' + searchNameEncoded) ||
        // Busca parcial: timestamp_baseName.ext
        (n.includes(baseName) && n.endsWith('.' + ext)) ||
        (n.includes(baseNameUnderscore) && n.endsWith('.' + ext)) ||
        // Busca por extensão + substring do nome
        (ext && n.endsWith('.' + ext) && (
          n.includes(searchName) || n.includes(searchNameUnderscore)
        ))
      );
    };

    const searchInList = async (path: string): Promise<string | null> => {
      try {
        const { data: listData, error: listError } = await supabase.storage
          .from(BUCKET_NAME)
          .list(path, { limit: 1000 });
        if (listError) {
          console.warn('[getSignedUrlFromStorage] List error at path:', path, listError.message);
          return null;
        }
        if (!listData?.length) return null;

        console.log(`[getSignedUrlFromStorage] Listed ${listData.length} files at "${path || 'root'}"`);
        const found = listData.find(matchByName);
        if (!found) return null;

        console.log('[getSignedUrlFromStorage] Found matching file:', found.name);
        const objectPath = path ? `${path}/${found.name}` : found.name;
        const url = await getCachedSignedUrl(objectPath, expiresIn);
        return url || null;
      } catch (e) {
        console.warn('[getSignedUrlFromStorage] searchInList error:', e);
        return null;
      }
    };

    // Buscar na raiz do bucket
    let foundUrl = await searchInList('');
    if (foundUrl) return foundUrl;

    // Buscar em subpastas (primeiro nível)
    try {
      const { data: rootList, error: rootErr } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', { limit: 100 });
      if (!rootErr && rootList?.length) {
        for (const item of rootList) {
          // Subpastas não têm extensão
          if (!item.name.includes('.')) {
            foundUrl = await searchInList(item.name);
            if (foundUrl) return foundUrl;
          }
        }
      }
    } catch (listErr) {
      console.warn('[getSignedUrlFromStorage] Subfolder search failed:', listErr);
    }

    // 3. Nenhuma busca encontrou o arquivo
    console.error('[getSignedUrlFromStorage] File not found in bucket. Searched:', filename, '| Fallback:', fallbackFilename);
    throw new Error(`Arquivo não encontrado no storage: ${filename}`);
  } catch (error: any) {
    console.error('Exception getting signed URL:', error?.message);
    throw error;
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
      // No mobile, URLs assinadas do Supabase podem retornar 400 com File.downloadFileAsync.
      // Gerar sempre uma URL assinada nova antes do download usando o path do storage.
      let urlToDownload = remoteUrl;
      const signMatch = remoteUrl.match(/\/object\/sign\/[^/]+\/([^/?]+)(\?|$)/);
      if (signMatch && signMatch[1]) {
        try {
          const freshUrl = await getSignedUrlFromStorage(signMatch[1], filename || sanitizedFilename);
          if (freshUrl && (freshUrl.startsWith('http://') || freshUrl.startsWith('https://'))) {
            urlToDownload = freshUrl;
          }
        } catch (e) {
          console.warn('Could not get fresh signed URL, using original:', e);
        }
      }

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
        await File.downloadFileAsync(urlToDownload, localFile, { idempotent: true });
        localUri = localFile.uri;
      }
    } else {
      // Não é URL nem arquivo local — provavelmente é um storage path / nome de arquivo
      // no bucket do Supabase. Gerar signed URL e baixar.
      console.log('[downloadAndOpenAttachment] Storage path detected, generating signed URL for:', remoteUrl);
      try {
        const freshUrl = await getSignedUrlFromStorage(remoteUrl, filename || sanitizedFilename);
        if (!freshUrl || (!freshUrl.startsWith('http://') && !freshUrl.startsWith('https://'))) {
          Alert.alert('Erro', 'Não foi possível obter a URL do arquivo');
          return;
        }

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
          await File.downloadFileAsync(freshUrl, localFile, { idempotent: true });
          localUri = localFile.uri;
        }
      } catch (error: any) {
        console.error('Error downloading from storage path:', error);
        const msg = error?.message?.includes('não encontrado') || error?.message?.includes('not found')
          ? 'O arquivo não foi encontrado no servidor. Ele pode ter sido excluído ou não foi salvo corretamente.'
          : `Não foi possível abrir o arquivo: ${error?.message || 'Erro desconhecido'}`;
        Alert.alert('Erro', msg);
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
