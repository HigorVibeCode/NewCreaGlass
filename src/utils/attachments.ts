import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Alert } from 'react-native';

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
      // Web ou outras plataformas - não suportado
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
