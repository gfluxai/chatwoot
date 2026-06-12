class Api::V1::Accounts::AtendimentoTokensController < Api::V1::Accounts::BaseController
  def show
    @token = Atendimento::SupabaseTokenService.new(user: current_user).generate

    if @token.blank?
      head :not_found
      return
    end

    render json: @token
  end
end
