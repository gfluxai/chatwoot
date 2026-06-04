import { createClient } from '@supabase/supabase-js';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';

export class TabloRealtimeService {
  constructor() {
    this.channels = [];
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

    const { restaurant_id: restaurantId } = profile;

    const onEstagioChange = payload => {
      if (payload.new?.estagio !== 'humano') return;
      // Quando um agente humano assume manualmente, não notificar
      if (payload.new?.reason === 'Humano Assumiu Conversa') return;
      emitter.emit(BUS_EVENTS.TABLO_HUMAN_HANDOFF, {
        id: payload.new.id,
        telefone: payload.new.telefone,
        reason: payload.new.reason,
        conversationId: payload.new.conversation_id,
      });
    };

    // Escuta INSERT e UPDATE na tabela estagios
    const handoffChannel = this.supabaseClient
      .channel('tablo-handoffs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'estagios',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, onEstagioChange)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'estagios',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, onEstagioChange)
      .subscribe();

    // Escuta apenas INSERT na tabela reservations com source = WhatsApp Agent
    const reservationChannel = this.supabaseClient
      .channel('tablo-reservations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'reservations',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, payload => {
        if (payload.new?.source !== 'WhatsApp Agent') return;
        emitter.emit(BUS_EVENTS.TABLO_NEW_RESERVATION, {
          id: payload.new.id,
          restaurantId: payload.new.restaurant_id,
        });
      })
      .subscribe();

    this.channels = [handoffChannel, reservationChannel];
  }

  disconnect() {
    if (this.supabaseClient && this.channels.length) {
      this.channels.forEach(ch => this.supabaseClient.removeChannel(ch));
    }
    this.channels = [];
    this.supabaseClient = null;
  }
}

export default new TabloRealtimeService();
