import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthRepository } from '../../services/repositories/interfaces';
import { Session, User } from '../../types';
import { MockUsersRepository } from './MockUsersRepository';

const STORAGE_KEY = 'mock_auth_session';
const MASTER_USERNAME = 'Pia';
const MASTER_PASSWORD = 'Happiness';

export class MockAuthRepository implements AuthRepository {
  private usersRepo: MockUsersRepository;

  constructor() {
    this.usersRepo = new MockUsersRepository();
  }

  async login(username: string, password: string): Promise<Session> {
    // Check Master user first (hardcoded)
    if (username === MASTER_USERNAME && password === MASTER_PASSWORD) {
      const user: User = {
        id: 'master-1',
        username: MASTER_USERNAME,
        userType: 'Master',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      
      const session: Session = {
        user,
        token: 'mock-token-' + Date.now(),
      };
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return session;
    }
    
    // Check other users from repository
    const user = await this.usersRepo.getUserByUsername(username);
    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }
    
    const userPassword = await this.usersRepo.getUserPassword(user.id);
    if (!userPassword || userPassword !== password) {
      throw new Error('Invalid credentials');
    }
    
    const session: Session = {
      user,
      token: 'mock-token-' + Date.now(),
    };
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  }
  
  async logout(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
  
  async getCurrentSession(): Promise<Session | null> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  }

  async validateSession(session: Session): Promise<boolean> {
    // In mock implementation, always validate against stored session
    // In production, this should validate with Supabase backend
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      
      const storedSession: Session = JSON.parse(stored);
      
      // Validate that session matches stored session and user is still active
      if (storedSession.user.id !== session.user.id) {
        return false;
      }
      
      // Check if user is still active
      const user = await this.usersRepo.getUserById(session.user.id);
      if (!user || !user.isActive) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    const session = await this.getCurrentSession();
    if (!session?.user?.id) return false;
    const storedPassword = await this.usersRepo.getUserPassword(session.user.id);
    return storedPassword !== null && storedPassword === password;
  }
}
