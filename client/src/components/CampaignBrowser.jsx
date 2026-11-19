import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid } from 'lucide-react';
import { api } from '../lib/api';
import { Chips, EmptyState, Notice, Skeleton } from '../ui';
import CampaignCard from './CampaignCard';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'genz', label: 'Gen Z & college' },
  { value: 'podcast', label: 'Podcasts' },
  { value: 'music', label: 'Music' },
  { value: 'regional', label: 'Regional language' },
];

export function useCampaigns(vertical = 'all') {
  return useQuery({
    queryKey: ['campaigns', vertical],
    queryFn: () => api(`/campaigns${vertical !== 'all' ? `?vertical=${vertical}` : ''}`),
    staleTime: 30_000,
  });
}

/** Filter chips + grid of live campaigns. Cards link to `${basePath}/:id`. */
export default function CampaignBrowser({ basePath, limit }) {
  const [vertical, setVertical] = useState('all');
  const { data, isPending, error } = useCampaigns(vertical);
  const campaigns = limit ? data?.campaigns.slice(0, limit) : data?.campaigns;

  return (
    <>
      {!limit && (
        <div className="mb-5">
          <Chips label="Filter by category" options={FILTERS} value={vertical} onChange={setVertical} />
        </div>
      )}
      {error ? (
        <Notice tone="danger">{error.message}</Notice>
      ) : isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/4]" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState icon={LayoutGrid} title={vertical === 'all' ? 'No live campaigns yet' : 'Nothing in this category yet'}>
          New paid campaigns show up here as soon as brands launch them.
        </EmptyState>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} to={`${basePath}/${c.id}`} />
          ))}
        </div>
      )}
    </>
  );
}
