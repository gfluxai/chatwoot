import { createClient } from '@supabase/supabase-js';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';

const HUMAN_LABEL_TITLE = 'atendimento-humano';
const HUMAN_LABEL_COLOR = '#F97316';
const HUMAN_LABEL_DESCRIPTION = 'Conversa em atendimento humano';

export class AtendimentoRealtimeService {
  constructor() {
    this.channels = [];
    this.supabaseClient = null;
    this.accountId = null;
  }

  async connect(user) {
    const { appSupabaseUrl, appSupabaseAnonKey } = window.chatwootConfig || {};
    if (!appSupabaseUrl || !appSupabaseAnonKey || !user?.id) return;

    this.disconnect();

    this.accountId = user.account_id;
    this.supabaseClient = createClient(appSupabaseUrl, appSupabaseAnonKey);

    const { data: channels, error } = await this.supabaseClient
      .from('channels')
      .select('organization_id')
      .eq('chatwoot_user_id', String(user.id))
      .limit(1);

    const organizationId = channels?.[0]?.organization_id;
    if (error || !organizationId) return;

    await this.ensureHumanHandoffLabel();

    // A tabela conversations é a linha mestre, atualizada a cada mensagem,
    // então só agimos quando o stage realmente transiciona de/para 'human'.
    const onConversationStageChange = payload => {
      const conversationId = Number(payload.new?.chatwoot_conversation_id);
      if (!conversationId) return;

      const wasHuman = payload.old?.stage === 'human';
      const isHuman = payload.new?.stage === 'human';

      if (isHuman && !wasHuman) {
        emitter.emit(BUS_EVENTS.HUMAN_HANDOFF, {
          id: payload.new.id,
          telefone: payload.new.contact_phone,
          contactName: payload.new.contact_name,
          reason: payload.new.handoff_reason,
          conversationId,
        });
        this.addHumanLabel(conversationId);
      } else if (!isHuman && wasHuman) {
        this.removeHumanLabel(conversationId);
      }
    };

    const conversationsChannel = this.supabaseClient
      .channel('atendimento-conversations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `organization_id=eq.${organizationId}`,
        },
        onConversationStageChange
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `organization_id=eq.${organizationId}`,
        },
        onConversationStageChange
      )
      .subscribe();

    this.channels = [conversationsChannel];
  }

  async ensureHumanHandoffLabel() {
    if (!this.accountId) return;
    try {
      const { data } = await window.axios.get(
        `/api/v1/accounts/${this.accountId}/labels`
      );
      const labels = data?.payload || [];
      const exists = labels.some(label => label.title === HUMAN_LABEL_TITLE);
      if (exists) return;

      await window.axios.post(`/api/v1/accounts/${this.accountId}/labels`, {
        label: {
          title: HUMAN_LABEL_TITLE,
          description: HUMAN_LABEL_DESCRIPTION,
          color: HUMAN_LABEL_COLOR,
          show_on_sidebar: true,
        },
      });
    } catch (error) {
      // Se outro agente criar a etiqueta ao mesmo tempo, o backend rejeita
      // por unicidade do título - ignorar.
    }
  }

  async addHumanLabel(conversationId) {
    if (!this.accountId) return;
    try {
      const { data } = await window.axios.get(
        `/api/v1/accounts/${this.accountId}/conversations/${conversationId}/labels`
      );
      const current = data?.payload || [];
      if (current.includes(HUMAN_LABEL_TITLE)) return;

      await window.axios.post(
        `/api/v1/accounts/${this.accountId}/conversations/${conversationId}/labels`,
        { labels: [...current, HUMAN_LABEL_TITLE] }
      );
    } catch (error) {
      // Falha ao sincronizar a etiqueta - o próximo evento de stage tenta novamente
    }
  }

  async removeHumanLabel(conversationId) {
    if (!this.accountId) return;
    try {
      const { data } = await window.axios.get(
        `/api/v1/accounts/${this.accountId}/conversations/${conversationId}/labels`
      );
      const current = data?.payload || [];
      if (!current.includes(HUMAN_LABEL_TITLE)) return;

      await window.axios.post(
        `/api/v1/accounts/${this.accountId}/conversations/${conversationId}/labels`,
        { labels: current.filter(label => label !== HUMAN_LABEL_TITLE) }
      );
    } catch (error) {
      // Falha ao sincronizar a etiqueta - o próximo evento de stage tenta novamente
    }
  }

  disconnect() {
    if (this.supabaseClient && this.channels.length) {
      this.channels.forEach(ch => this.supabaseClient.removeChannel(ch));
    }
    this.channels = [];
    this.supabaseClient = null;
    this.accountId = null;
  }
}

export default new AtendimentoRealtimeService();
