class Internal::ReconcilePlanConfigService
  BRANDING_KEYS = %w[
    INSTALLATION_NAME
    BRAND_URL
    WIDGET_BRAND_URL
    LOGO
    LOGO_DARK
    LOGO_THUMBNAIL
    TERMS_URL
    PRIVACY_URL
    DISPLAY_MANIFEST
  ].freeze

  def perform
    remove_premium_config_reset_warning
    return if ChatwootHub.pricing_plan != 'community'

    create_premium_config_reset_warning if premium_config_reset_required?

    reconcile_premium_config
    reconcile_premium_features
  end

  private

  def config_path
    @config_path ||= Rails.root.join('enterprise/config')
  end

  def premium_config
    @premium_config ||= YAML.safe_load(File.read("#{config_path}/premium_installation_config.yml")).freeze
  end

  def remove_premium_config_reset_warning
    Redis::Alfred.delete(Redis::Alfred::CHATWOOT_INSTALLATION_CONFIG_RESET_WARNING)
  end

  def create_premium_config_reset_warning
    Redis::Alfred.set(Redis::Alfred::CHATWOOT_INSTALLATION_CONFIG_RESET_WARNING, true)
  end

  def premium_config_reset_required?
    premium_config.any? do |config|
      cfg = config.with_indifferent_access
      next false if BRANDING_KEYS.include?(cfg[:name])  # ✅ ignora branding

      existing = InstallationConfig.find_by(name: cfg[:name])
      existing.present? && existing.value != cfg[:value]
    end
  end

  def reconcile_premium_config
    premium_config.each do |config|
      cfg = config.with_indifferent_access
      next if BRANDING_KEYS.include?(cfg[:name])        # ✅ ignora branding

      existing = InstallationConfig.find_by(name: cfg[:name])
      next if existing&.value == cfg[:value]

      existing&.update!(value: cfg[:value])
    end
  end

  def premium_features
    @premium_features ||= YAML.safe_load(File.read("#{config_path}/premium_features.yml")).freeze
  end

  def reconcile_premium_features
    Account.find_in_batches do |accounts|
      accounts.each do |account|
        account.disable_features!(*premium_features)
      end
    end
  end
end