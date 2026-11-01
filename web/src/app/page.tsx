import MapApp from '@/components/MapApp';
import { getProperties } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const properties = await getProperties();
  return <MapApp properties={properties} />;
}
