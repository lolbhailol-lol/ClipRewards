import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { InstagramIcon, YoutubeIcon } from '../ui/PlatformIcons';
import { Status, Tag, cx } from '../ui';
import { daysLeft, img, ratePer1k, verticalLabel } from '../lib/format';

export const PLATFORM_ICON = { instagram: InstagramIcon, youtube: YoutubeIcon };

/**
 * Campaign tile. Accepts an API campaign ({ ratePer1kPaise, budgetLeftPct, endsAt, brand, ... }).
 * `to` makes the whole card a link. `example` labels it as illustrative.
 */
export default function CampaignCard({ campaign, to, example, className, style }) {
  const { title, platforms = [], budgetLeftPct = 0, type, vertical, joined } = campaign;
  const brand = campaign.brand?.name ?? campaign.brand;
  const days = campaign.endsAt ? daysLeft(campaign.endsAt) : campaign.daysLeft;

  const body = (
    <>
      <div className="stripes relative aspect-[16/10] overflow-hidden rounded-[1.25rem]">
        {campaign.coverUrl && (
          <>
            <img src={img(campaign.coverUrl, 720)} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/55" aria-hidden />
          </>
        )}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <div className="flex gap-1.5">
            {platforms.map((p) => {
              const Icon = PLATFORM_ICON[p];
              return (
                <span key={p} className="glass-solid grid size-8 place-items-center rounded-full">
                  <Icon className="size-4" aria-label={p} />
                </span>
              );
            })}
          </div>
          {example ? (
            <span className="glass-solid rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">Example</span>
          ) : joined ? (
            <Status tone="success">Joined</Status>
          ) : (
            <Status tone="live">Live</Status>
          )}
        </div>
        <div className="glass-solid absolute inset-x-2.5 bottom-2.5 flex items-center rounded-2xl px-4 py-2.5">
          <StatBit value={ratePer1k(campaign.ratePer1kPaise)} label="per 1K" />
          <StatBit value={`${budgetLeftPct}%`} label="left" />
          <StatBit value={`${days}d`} label="to go" />
          <ChevronRight className="size-4 text-muted" aria-hidden />
        </div>
      </div>
      <div className="px-3 pb-3 pt-3.5">
        <p className="truncate text-[13px] text-muted">{brand}</p>
        <p className="mt-0.5 truncate text-[15px] font-semibold">{title}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {type && <Tag>{type === 'ugc' ? 'UGC' : 'Clipping'}</Tag>}
          {vertical && <Tag>{verticalLabel(vertical)}</Tag>}
        </div>
      </div>
    </>
  );

  const cls = cx('glass group block overflow-hidden rounded-3xl p-2 text-left', to && 'hover:bg-glass-2', className);
  return to ? (
    <Link to={to} className={cls} style={style}>
      {body}
    </Link>
  ) : (
    <article className={cls} style={style}>
      {body}
    </article>
  );
}

function StatBit({ value, label, className = '' }) {
  return (
    <div className="min-w-0 flex-1">
      <p className={`truncate font-mono text-[15px] font-medium tabular-nums ${className}`}>{value}</p>
      <p className="truncate font-mono text-[9px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}
