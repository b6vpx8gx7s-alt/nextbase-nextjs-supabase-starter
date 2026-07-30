import { getAdminBusinesses } from '@/data/admin/businesses';
import { AdminMasterClient } from './AdminMasterClient';

export const dynamic = 'force-dynamic';

export default async function AdminMasterPage() {
  const businesses = await getAdminBusinesses();
  return <AdminMasterClient businesses={businesses} />;
}
