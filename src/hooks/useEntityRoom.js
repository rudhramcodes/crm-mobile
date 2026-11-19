import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '@/services/api';
import { getSocket } from '@/services/socket';

// Follow one record live: join its `type:id` room and refetch it when someone else changes it.
export function useEntityRoom(type, id, tag) {
  const dispatch = useDispatch();
  useEffect(() => {
    const s = getSocket();
    if (!s || !id) return undefined;
    const room = `${type}:${id}`;
    const join = () => s.emit('join:room', room);
    const onUpdate = (p) => {
      if (p?.entityType === type && String(p.entityId) === String(id)) dispatch(api.util.invalidateTags([{ type: tag, id }, tag]));
    };
    join();
    s.on('connect', join); // rooms are lost on reconnect
    s.on('entity:updated', onUpdate);
    return () => {
      s.emit('leave:room', room);
      s.off('connect', join);
      s.off('entity:updated', onUpdate);
    };
  }, [type, id, tag, dispatch]);
}
