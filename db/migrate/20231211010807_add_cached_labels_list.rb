class AddCachedLabelsList < ActiveRecord::Migration[7.0]
  def change
    add_column :conversations, :cached_label_list, :string

    # compat: acts-as-taggable-on mudou o módulo
    if defined?(ActsAsTaggableOn::Taggable::Cache)
      ActsAsTaggableOn::Taggable::Cache.included(Conversation)
    elsif defined?(ActsAsTaggableOn::Taggable::CacheKeys)
      ActsAsTaggableOn::Taggable::CacheKeys.included(Conversation)
    end
  end
end
