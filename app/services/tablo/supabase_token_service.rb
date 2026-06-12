# Mints a short-lived JWT scoped to the agent's restaurant_id so the
# dashboard can talk to the Tablo Supabase project (Realtime + REST)
# without exposing the service_role key to the browser.
class Tablo::SupabaseTokenService
  TOKEN_EXPIRY = 12.hours

  def initialize(user:)
    @user = user
  end

  def generate
    return if jwt_secret.blank?

    restaurant_id = fetch_restaurant_id
    return if restaurant_id.blank?

    {
      token: build_token(restaurant_id),
      restaurant_id: restaurant_id
    }
  end

  private

  attr_reader :user

  def fetch_restaurant_id
    return if supabase_url.blank? || service_role_key.blank?

    response = HTTParty.get(
      "#{supabase_url}/rest/v1/profiles",
      query: { select: 'restaurant_id', chatwoot_user_id: "eq.#{user.id}", limit: 1 },
      headers: supabase_headers
    )

    return unless response.success?

    response.parsed_response.first&.dig('restaurant_id')
  rescue StandardError => e
    Rails.logger.error("Tablo::SupabaseTokenService restaurant lookup failed: #{e.message}")
    nil
  end

  def build_token(restaurant_id)
    JWT.encode(
      {
        role: 'authenticated',
        restaurant_id: restaurant_id,
        exp: TOKEN_EXPIRY.from_now.to_i
      },
      jwt_secret,
      'HS256'
    )
  end

  def supabase_headers
    {
      'apikey' => service_role_key,
      'Authorization' => "Bearer #{service_role_key}"
    }
  end

  def supabase_url
    ENV.fetch('TABLO_SUPABASE_URL', '')
  end

  def service_role_key
    ENV.fetch('TABLO_SUPABASE_SERVICE_ROLE_KEY', '')
  end

  def jwt_secret
    ENV.fetch('TABLO_SUPABASE_JWT_SECRET', '')
  end
end
