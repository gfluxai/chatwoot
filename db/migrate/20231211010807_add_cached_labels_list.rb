class AddCachedLabelsList < ActiveRecord::Migration[7.0]
  def change
    unless column_exists?(:conversations, :cached_label_list)
      add_column :conversations, :cached_label_list, :string
    end
  end
end
