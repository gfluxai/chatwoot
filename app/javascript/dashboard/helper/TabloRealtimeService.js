import { createClient } from '@supabase/supabase-js';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';

export class TabloRealtimeService {
  constructor() {
    this.channel = null;
    this.supabaseClient = null;
  }

  async connect(user) {
    const { tabloSupabaseUrl, tabloSupabaseAnonKey } =
      window.chatwootConfig || {};
    if (!tabloSupabaseUrl || !tabloSupabaseAnonKey || !user?.id) return;

    this.disconnect();

    this.supabaseClient = createClient(tabloSupabaseUrl, tabloSupabaseAnonKey);

    const { data: profile, error } = await this.supabaseClient
      .from('profiles')
      .select('restaurant_id')
      .eq('chatwoot_user_id', user.id)
      .single();

    if (error || !profile?.restaurant_id) return;

    this.channel = this.supabaseClient
      .channel('tablo-handoffs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'estagios',
          filter: `restaurant_id=eq.${profile.restaurant_id}`,
        },
        payload => {
          if (payload.new?.estagio !== 'humano') return;
          emitter.emit(BUS_EVENTS.TABLO_HUMAN_HANDOFF, {
            id: payload.new.id,
            telefone: payload.new.telefone,
            reason: payload.new.reason,
            conversationId: payload.new.conversation_id,
          });
        }
      )
      .subscribe();
  }

  disconnect() {
    if (this.channel && this.supabaseClient) {
      this.supabaseClient.removeChannel(this.channel);
    }
    this.channel = null;
    this.supabaseClient = null;
  }
}

export default new TabloRealtimeService();
