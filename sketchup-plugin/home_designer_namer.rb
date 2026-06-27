# Home Designer — Nommage (extension SketchUp)
#
# Fichier de chargement (loader) : il enregistre l'extension auprès de SketchUp.
# Le code réel vit dans `home_designer_namer/main.rb`.
#
# Objectif (backlog E9-01) : nommer les groupes/composants SketchUp selon la
# convention Home3D `système__type__zone__niveau__index` SANS faute de frappe, et
# assigner le Tag correspondant — pour arrêter de modéliser la maison en un seul
# bloc et garantir un export GLB exploitable du premier coup.
#
# Convention source unique : home3d/script/naming.mjs (partagée avec le pipeline).

require 'sketchup.rb'
require 'extensions.rb'

module HomeDesigner
  module Namer
    PLUGIN_DIR = File.join(File.dirname(__FILE__), 'home_designer_namer').freeze

    unless defined?(@loaded) && @loaded
      extension = SketchupExtension.new(
        'Home Designer — Nommage',
        File.join(PLUGIN_DIR, 'main')
      )
      extension.description =
        'Nomme les groupes/composants selon la convention Home3D ' \
        '(systeme__type__zone__niveau__index) et assigne le Tag. ' \
        'Garantit des noms qui passent la validation du pipeline GLB.'
      extension.version = '1.0.0'
      extension.creator = 'Home Designer'
      extension.copyright = '2026'

      Sketchup.register_extension(extension, true)
      @loaded = true
    end
  end
end
