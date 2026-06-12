class Api::V1::Accounts::TabloTokensController < Api::V1::Accounts::BaseController
  def show
    @tablo_token = Tablo::SupabaseTokenService.new(user: current_user).generate

    if @tablo_token.blank?
      head :not_found
      return
    end

    render json: @tablo_token
  end
end
