import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { DocumentsRepository } from '../../services/repositories/interfaces';
import { Document } from '../../types';

const STORAGE_KEY = 'mock_documents';
const DOCUMENTS_DIR_NAME = 'documents';

export class MockDocumentsRepository implements DocumentsRepository {
  private async getDocuments(): Promise<Document[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  }
  
  private async saveDocuments(documents: Document[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  }
  
  async getAllDocuments(): Promise<Document[]> {
    return this.getDocuments();
  }
  
  async getDocumentById(documentId: string): Promise<Document | null> {
    const documents = await this.getDocuments();
    return documents.find(d => d.id === documentId) || null;
  }
  
  async uploadDocument(
    file: File | { uri: string; name: string; type: string },
    userId: string
  ): Promise<Document> {
    const documents = await this.getDocuments();
    const filename = 'name' in file ? file.name : file.uri.split('/').pop() || 'unknown';
    const mimeType = 'type' in file ? file.type : 'application/octet-stream';
    
    // Garantir que o diretório de documentos existe
    const documentsDir = new Directory(Paths.document, DOCUMENTS_DIR_NAME);
    const dirInfo = await documentsDir.info();
    if (!dirInfo.exists) {
      await documentsDir.make();
    }
    
    // Copiar o arquivo para o diretório permanente
    const fileUri = 'uri' in file ? file.uri : '';
    const timestamp = Date.now();
    const savedFilename = `${timestamp}_${filename}`;
    const destinationFile = new File(documentsDir, savedFilename);
    
    let finalStoragePath = destinationFile.uri;
    
    // Se temos um URI válido, copiar o arquivo
    if (fileUri && (fileUri.startsWith('file://') || fileUri.startsWith('content://'))) {
      try {
        const sourceFile = new File(fileUri);
        await sourceFile.copy(destinationFile);
        finalStoragePath = destinationFile.uri;
      } catch (error) {
        console.error('Error copying file:', error);
        // Se falhar ao copiar, usar o URI original
        finalStoragePath = fileUri;
      }
    } else if (fileUri) {
      // Se o URI não é local, usar diretamente (pode ser URL remota)
      finalStoragePath = fileUri;
    }
    
    const newDocument: Document = {
      id: 'doc-' + timestamp,
      filename,
      mimeType,
      storagePath: finalStoragePath, // Salvar o caminho real do arquivo
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    
    documents.push(newDocument);
    await this.saveDocuments(documents);
    return newDocument;
  }
  
  async getDocumentUrl(documentId: string): Promise<string> {
    const document = await this.getDocumentById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }
    // Return mock URL
    return document.storagePath;
  }
  
  async deleteDocument(documentId: string): Promise<void> {
    const documents = await this.getDocuments();
    const filtered = documents.filter(d => d.id !== documentId);
    await this.saveDocuments(filtered);
  }
}
