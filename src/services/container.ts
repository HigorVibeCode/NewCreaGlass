import {
  AuthRepository,
  UsersRepository,
  PermissionsRepository,
  DocumentsRepository,
  InventoryRepository,
  NotificationsRepository,
  BloodPriorityRepository,
  EventsRepository,
  ProductionRepository,
  WorkOrdersRepository,
} from './repositories/interfaces';

// Import Supabase repositories
import { SupabaseAuthRepository } from '../repositories/supabase/SupabaseAuthRepository';
import { SupabaseUsersRepository } from '../repositories/supabase/SupabaseUsersRepository';
import { SupabasePermissionsRepository } from '../repositories/supabase/SupabasePermissionsRepository';
import { SupabaseDocumentsRepository } from '../repositories/supabase/SupabaseDocumentsRepository';
import { SupabaseInventoryRepository } from '../repositories/supabase/SupabaseInventoryRepository';
import { SupabaseNotificationsRepository } from '../repositories/supabase/SupabaseNotificationsRepository';
import { SupabaseBloodPriorityRepository } from '../repositories/supabase/SupabaseBloodPriorityRepository';
import { SupabaseEventsRepository } from '../repositories/supabase/SupabaseEventsRepository';
import { SupabaseProductionRepository } from '../repositories/supabase/SupabaseProductionRepository';
import { SupabaseWorkOrdersRepository } from '../repositories/supabase/SupabaseWorkOrdersRepository';

// Import Mock repositories (for fallback or development)
import { MockAuthRepository } from '../repositories/mock/MockAuthRepository';
import { MockUsersRepository } from '../repositories/mock/MockUsersRepository';
import { MockPermissionsRepository } from '../repositories/mock/MockPermissionsRepository';
import { MockDocumentsRepository } from '../repositories/mock/MockDocumentsRepository';
import { MockInventoryRepository } from '../repositories/mock/MockInventoryRepository';
import { MockNotificationsRepository } from '../repositories/mock/MockNotificationsRepository';
import { MockBloodPriorityRepository } from '../repositories/mock/MockBloodPriorityRepository';
import { MockEventsRepository } from '../repositories/mock/MockEventsRepository';
import { MockProductionRepository } from '../repositories/mock/MockProductionRepository';
// TODO: Create MockWorkOrdersRepository if needed

// Dependency Injection Container
// Now using Supabase repositories for real-time sync across all devices
// Set USE_MOCK_REPOSITORIES=true in environment to use mock repositories

const USE_MOCK_REPOSITORIES = process.env.EXPO_PUBLIC_USE_MOCK_REPOSITORIES === 'true';

export const repos = {
  authRepo: (USE_MOCK_REPOSITORIES ? new MockAuthRepository() : new SupabaseAuthRepository()) as AuthRepository,
  usersRepo: (USE_MOCK_REPOSITORIES ? new MockUsersRepository() : new SupabaseUsersRepository()) as UsersRepository,
  permissionsRepo: (USE_MOCK_REPOSITORIES ? new MockPermissionsRepository() : new SupabasePermissionsRepository()) as PermissionsRepository,
  documentsRepo: (USE_MOCK_REPOSITORIES ? new MockDocumentsRepository() : new SupabaseDocumentsRepository()) as DocumentsRepository,
  inventoryRepo: (USE_MOCK_REPOSITORIES ? new MockInventoryRepository() : new SupabaseInventoryRepository()) as InventoryRepository,
  notificationsRepo: (USE_MOCK_REPOSITORIES ? new MockNotificationsRepository() : new SupabaseNotificationsRepository()) as NotificationsRepository,
  bloodPriorityRepo: (USE_MOCK_REPOSITORIES ? new MockBloodPriorityRepository() : new SupabaseBloodPriorityRepository()) as BloodPriorityRepository,
  eventsRepo: (USE_MOCK_REPOSITORIES ? new MockEventsRepository() : new SupabaseEventsRepository()) as EventsRepository,
  productionRepo: (USE_MOCK_REPOSITORIES ? new MockProductionRepository() : new SupabaseProductionRepository()) as ProductionRepository,
  workOrdersRepo: new SupabaseWorkOrdersRepository() as WorkOrdersRepository, // Always use Supabase for work orders
};
