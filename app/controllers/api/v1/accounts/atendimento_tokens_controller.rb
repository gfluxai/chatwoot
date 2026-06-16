class Api::V1::Accounts::AtendimentoTokensController < Api::V1::Accounts::BaseController
  def show
    @atendimento_token = Atendimento::SupabaseTokenService.new(user: current_user).generate

    if @atendimento_token.blank?
      head :not_found
      return
    end

    render json: @atendimento_token
  end
end
