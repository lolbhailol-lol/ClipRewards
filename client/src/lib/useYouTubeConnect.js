import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { completeYouTubeRedirect, connectYouTube, connectYouTubeRedirect } from './firebase';

/**
 * YouTube connect for any screen.
 * - connect():        Google popup → token → server finds the channel.
 * - connectInWindow(): same flow without a popup (page reloads back here).
 * On mount it also finishes a same-window connect that just returned.
 * `error.canRedirect` tells the UI to offer "Continue in this window".
 */
export function useYouTubeConnect({ onConnected } = {}) {
  const qc = useQueryClient();

  const finish = async (accessToken) => {
    const res = await api('/social/youtube/connect', { method: 'POST', body: { accessToken } });
    qc.invalidateQueries({ queryKey: ['social'] });
    qc.invalidateQueries({ queryKey: ['me'] });
    return res;
  };

  const popup = useMutation({
    mutationFn: async () => finish(await connectYouTube()),
    onSuccess: (res) => onConnected?.(res),
  });
  const inWindow = useMutation({ mutationFn: connectYouTubeRedirect });
  const returning = useMutation({
    mutationFn: async () => {
      const token = await completeYouTubeRedirect();
      return token ? finish(token) : null;
    },
    onSuccess: (res) => res && onConnected?.(res),
  });

  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    returning.mutate();
  }, [returning]);

  const error = popup.error || returning.error || inWindow.error;
  return {
    connect: () => {
      returning.reset();
      popup.mutate();
    },
    connectInWindow: () => inWindow.mutate(),
    isPending: popup.isPending || inWindow.isPending || returning.isPending,
    error,
    // Server errors (e.g. YouTube permission box not ticked) can also be retried in-window.
    canRedirect: Boolean(error && (error.canRedirect || error.status === 400)),
    reset: () => {
      popup.reset();
      returning.reset();
    },
  };
}
