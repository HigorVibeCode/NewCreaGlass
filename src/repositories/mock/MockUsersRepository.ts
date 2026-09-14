import AsyncStorage from '@react-native-async-storage/async-storage';
import { UsersRepository } from '../../services/repositories/interfaces';
import { User } from '../../types';

const STORAGE_KEY = 'mock_users';
const STORAGE_KEY_PASSWORDS = 'mock_user_passwords';

interface UserPassword {
  userId: string;
  password: string;
}

export class MockUsersRepository implements UsersRepository {
  private async getUsers(): Promise<User[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Initialize with Master user
      const masterUser: User = {
        id: 'master-1',
        username: 'Pia',
        userType: 'Master',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      await this.saveUsers([masterUser]);
      return [masterUser];
    }
    return JSON.parse(stored);
  }
  
  private async saveUsers(users: User[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }
  
  private async getPasswords(): Promise<UserPassword[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_PASSWORDS);
    if (!stored) return [];
    return JSON.parse(stored);
  }
  
  private async savePasswords(passwords: UserPassword[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_PASSWORDS, JSON.stringify(passwords));
  }
  
  async getAllUsers(): Promise<User[]> {
    return this.getUsers();
  }
  
  async getUserById(userId: string): Promise<User | null> {
    const users = await this.getUsers();
    return users.find(u => u.id === userId) || null;
  }
  
  async getUserByUsername(username: string): Promise<User | null> {
    const users = await this.getUsers();
    return users.find(u => u.username === username) || null;
  }
  
  async getUserPassword(userId: string): Promise<string | null> {
    const passwords = await this.getPasswords();
    const userPassword = passwords.find(up => up.userId === userId);
    return userPassword ? userPassword.password : null;
  }
  
  async setUserPassword(userId: string, password: string): Promise<void> {
    const passwords = await this.getPasswords();
    const index = passwords.findIndex(up => up.userId === userId);
    if (index >= 0) {
      passwords[index].password = password;
    } else {
      passwords.push({ userId, password });
    }
    await this.savePasswords(passwords);
  }
  
  async createUser(user: Omit<User, 'id' | 'createdAt'>, password?: string): Promise<User> {
    const users = await this.getUsers();
    const newUser: User = {
      ...user,
      id: 'user-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    await this.saveUsers(users);
    
    if (password) {
      await this.setUserPassword(newUser.id, password);
    }
    
    return newUser;
  }
  
  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const users = await this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) {
      throw new Error('User not found');
    }
    users[index] = { ...users[index], ...updates };
    await this.saveUsers(users);
    return users[index];
  }
  
  async activateUser(userId: string): Promise<void> {
    await this.updateUser(userId, { isActive: true });
  }
  
  async deactivateUser(userId: string): Promise<void> {
    await this.updateUser(userId, { isActive: false });
  }
  
  async changeUserPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    await this.setUserPassword(userId, newPassword);
  }

  async updatePreferredLanguage(userId: string, language: string): Promise<void> {
    await this.updateUser(userId, { preferredLanguage: language });
  }
}
