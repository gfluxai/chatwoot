# Mints a short-lived JWT scoped to the agent's organization_id so the
# dashboard can talk to the product's Supabase project (Realtime + REST)
# without exposing the service_role key to the browser.
class Atendimento::SupabaseTokenService
  TOKEN_EXPIRY = 12.hours

  def initialize(user:)
    @user = user
  end

  def generate
    return if jwt_secret.blank?

    organization_id = fetch_organization_id
    return if organization_id.blank?

    {
      token: build_token(organization_id),
      organization_id: organization_id
    }
  end

  private

  attr_reader :user

  def fetch_organization_id
    return if supabase_url.blank? || service_role_key.blank?

    response = HTTParty.get(
      "#{supabase_url}/rest/v1/channels",
      query: { select: 'organization_id', chatwoot_user_id: "eq.#{user.id}", limit: 1 },
      headers: supabase_headers
    )

    unless response.success?
      Rails.logger.error(
        "Atendimento::SupabaseTokenService organization lookup failed: HTTP #{response.code}, body=#{response.body}"
      )
      return
    end

    JSON.parse(decoded_body(response)).first&.dig('organization_id')
  rescue StandardError => e
    Rails.logger.error("Atendimento::SupabaseTokenService organization lookup failed: #{e.message}")
    nil
  end

  def decoded_body(response)
    body = response.body
    return body unless response.headers['content-encoding'].to_s.include?('gzip')

    Zlib::GzipReader.new(StringIO.new(body)).read
  end

  def build_token(organization_id)
    JWT.encode(
      {
        role: 'authenticated',
        organization_id: organization_id,
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
    ENV.fetch('APP_SUPABASE_URL', '')
  end

  def service_role_key
    ENV.fetch('APP_SUPABASE_SERVICE_ROLE_KEY', '')
  end

  def jwt_secret
    ENV.fetch('APP_SUPABASE_JWT_SECRET', '')
  end
end
