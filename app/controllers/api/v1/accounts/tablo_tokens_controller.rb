class Api::V1::Accounts::TabloTokensController < Api::V1::Accounts::BaseController
  def show
    @token = Tablo::SupabaseTokenService.new(user: current_user).generate

    if @token.blank?
      head :not_found
      return
    end

    render json: @token
  end
end
