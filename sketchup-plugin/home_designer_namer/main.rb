# Home Designer — Nommage : logique principale.
#
# CONVENTION (source unique : home3d/script/naming.mjs)
#   Format de node name : systeme__type__zone__niveau__index(3 chiffres)
#   Regex pipeline :
#     ^(structure|ouvertures|elec|plomberie|vmc|reseau|terrain)
#      __[a-z0-9_]+__[a-z0-9_]+__(ss|rdc|r1|r2|combles|ext)__\d{3}$
#
# Ce module reproduit EXACTEMENT cette convention côté SketchUp pour que tout nom
# généré ici passe la validation du pipeline (process.mjs) sans correction.

module HomeDesigner
  module Namer
    # --- Convention (miroir de naming.mjs) -------------------------------------

    SYSTEMS = %w[structure ouvertures elec plomberie vmc reseau terrain].freeze
    LEVELS  = %w[ss rdc r1 r2 combles ext].freeze

    # Anchrage \A..\z (les ^ $ de Ruby sont des ancres de LIGNE, pas de chaîne).
    NODE_NAME_REGEX =
      /\A(structure|ouvertures|elec|plomberie|vmc|reseau|terrain)__[a-z0-9_]+__[a-z0-9_]+__(ss|rdc|r1|r2|combles|ext)__\d{3}\z/.freeze

    # Libellés FR des niveaux pour l'IHM (valeur convention → libellé lisible).
    LEVEL_LABELS = {
      'ss' => 'Sous-sol (ss)', 'rdc' => 'Rez-de-chaussée (rdc)',
      'r1' => '1er étage (r1)', 'r2' => '2e étage (r2)',
      'combles' => 'Combles (combles)', 'ext' => 'Extérieur (ext)'
    }.freeze

    # Vocabulaire de `type` suggéré par système (le segment type reste libre ;
    # ces listes alimentent juste les dropdowns). Tirées des exemples du CdC.
    TYPES_BY_SYSTEM = {
      'structure'  => %w[mur_porteur mur_cloison dalle plancher poteau poutre fondation toiture escalier forme],
      'ouvertures' => %w[porte_int porte_ext fenetre baie velux porte_garage],
      'elec'       => %w[prise interrupteur circuit_prises tableau luminaire cable gaine],
      'plomberie'  => %w[eau_froide eau_chaude evacuation sanitaire chauffe_eau],
      'vmc'        => %w[gaine bouche caisson chauffage radiateur],
      'reseau'     => %w[rj45 fibre coffret antenne],
      'terrain'    => %w[jardin terrasse cloture allee piscine]
    }.freeze

    # Zones courantes proposées (le segment zone reste libre).
    BASE_ZONES = %w[
      salon sejour cuisine sdb wc entree couloir degagement
      chambre1 chambre2 chambre3 bureau garage buanderie cellier dressing combles ext
    ].freeze

    OTHER = '(autre — saisir…)'.freeze

    # Mémorise les derniers choix pour pré-remplir l'IHM (confort de saisie).
    @last = { 'system' => 'structure', 'type' => 'mur_porteur',
              'zone' => 'salon', 'level' => 'rdc' }

    # --- Normalisation (miroir de normalizeSegment) ----------------------------

    # minuscules, accents retirés (NFD + suppression des marques combinantes),
    # espaces/tirets → `_`, caractères hors [a-z0-9_] supprimés.
    def self.normalize_segment(seg)
      seg.to_s
         .unicode_normalize(:nfd)
         .gsub(/\p{Mn}/, '')
         .downcase
         .gsub(/[\s\-]+/, '_')
         .gsub(/[^a-z0-9_]/, '')
    end

    # --- Parsing / index -------------------------------------------------------

    # Renvoie {system,type,zone,level,index} si `name` est conforme, sinon nil.
    def self.parse(name)
      return nil unless NODE_NAME_REGEX.match?(name.to_s)
      s, t, z, l, i = name.split('__')
      { system: s, type: t, zone: z, level: l, index: i.to_i }
    end

    # Itère récursivement tous les Groupes / Composants (porteurs de nom) du modèle.
    def self.each_named_entity(entities, &block)
      entities.each do |e|
        if e.is_a?(Sketchup::Group)
          block.call(e)
          each_named_entity(e.entities, &block)
        elsif e.is_a?(Sketchup::ComponentInstance)
          block.call(e)
          each_named_entity(e.definition.entities, &block)
        end
      end
    end

    # Prochain index libre du bucket (system, zone, level) : max existant + 1
    # (jamais count+1 → pas de réutilisation après suppression). `exclude_ids`
    # ignore certaines entités (typiquement la sélection en cours de renommage)
    # pour que re-nommer la même sélection ne fasse pas grimper l'index.
    def self.next_index(model, system, zone, level, exclude_ids = [])
      max = 0
      each_named_entity(model.entities) do |e|
        next if exclude_ids.include?(e.entityID)
        p = parse(e.name)
        next unless p
        if p[:system] == system && p[:zone] == zone && p[:level] == level && p[:index] > max
          max = p[:index]
        end
      end
      max + 1
    end

    def self.build_name(system, type, zone, level, index)
      format('%s__%s__%s__%s__%03d', system, type, zone, level, index)
    end

    # Une entité « porte de la géométrie » si elle contient directement des faces
    # (≈ un objet exportable). Sert à repérer le « bloc unique » non nommé.
    def self.carries_geometry?(ent)
      ents = ent.is_a?(Sketchup::Group) ? ent.entities : ent.definition.entities
      ents.any? { |c| c.is_a?(Sketchup::Face) }
    end

    # --- Action principale : nommer la sélection -------------------------------

    def self.name_selection
      model = Sketchup.active_model
      targets = model.selection.to_a.select do |e|
        e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
      end

      if targets.empty?
        UI.messagebox(
          "Sélectionne d'abord un ou plusieurs Groupes/Composants à nommer.\n\n" \
          "Astuce : si ta maison est un seul bloc, explose-la puis regroupe " \
          "chaque élément (mur, dalle…) dans son propre groupe."
        )
        return
      end

      values = prompt_values(model)
      return unless values # annulé

      system, type, zone, level = values.values_at('system', 'type', 'zone', 'level')

      exclude = targets.map(&:entityID)
      start = next_index(model, system, zone, level, exclude)

      if start + targets.size - 1 > 999
        UI.messagebox("Index > 999 atteint pour ce bucket — la convention impose " \
                      "3 chiffres. Découpe en sous-zones (ex. salon → salon_nord).")
        return
      end

      layer = model.layers.add(system) # crée le Tag si absent, sinon le réutilise
      names = []

      model.start_operation('Home Designer — Nommer la sélection', true)
      targets.each_with_index do |ent, i|
        name = build_name(system, type, zone, level, start + i)
        ent.name = name
        ent.layer = layer
        names << name
      end
      model.commit_operation

      @last = { 'system' => system, 'type' => type, 'zone' => zone, 'level' => level }

      summary = names.size == 1 ? names.first : "#{names.first} … #{names.last}"
      Sketchup.status_text = "#{names.size} objet(s) nommé(s) — Tag « #{system} » : #{summary}"
      puts "[Home Designer] #{names.size} objet(s) nommé(s), Tag « #{system} » :"
      names.each { |n| puts "  #{n}" }
    end

    # Dialogue de saisie. Dropdowns pour les listes fermées (système, niveau) et
    # pour les vocabulaires suggérés (type, zone) avec une option « (autre…) »
    # déclenchant une saisie libre normalisée. Renvoie un hash ou nil si annulé.
    def self.prompt_values(model)
      type_list = (TYPES_BY_SYSTEM[@last['system']] || []).dup
      type_list << @last['type'] unless type_list.include?(@last['type'])
      type_list << OTHER

      zones = (BASE_ZONES + existing_zones(model)).uniq
      zones << @last['zone'] unless zones.include?(@last['zone'])
      zones << OTHER

      level_choices = LEVELS.map { |l| LEVEL_LABELS[l] }

      prompts  = ['Système', 'Type', 'Zone', 'Niveau']
      defaults = [@last['system'], @last['type'], @last['zone'], LEVEL_LABELS[@last['level']]]
      lists    = [SYSTEMS.join('|'), type_list.join('|'), zones.join('|'), level_choices.join('|')]

      res = UI.inputbox(prompts, defaults, lists, 'Home Designer — Nommer (convention Home3D)')
      return nil unless res

      system, type_raw, zone_raw, level_label = res

      # Saisie libre si « (autre…) » a été choisi pour type et/ou zone.
      free_prompts = []
      free_defaults = []
      free_prompts << 'Type (libre)'  if type_raw == OTHER
      free_prompts << 'Zone (libre)'  if zone_raw == OTHER
      free_defaults = Array.new(free_prompts.size, '')
      unless free_prompts.empty?
        free = UI.inputbox(free_prompts, free_defaults, 'Home Designer — Saisie libre')
        return nil unless free
        idx = 0
        if type_raw == OTHER then type_raw = free[idx]; idx += 1 end
        zone_raw = free[idx] if zone_raw == OTHER
      end

      type = normalize_segment(type_raw)
      zone = normalize_segment(zone_raw)
      level = LEVELS[level_choices.index(level_label)] || @last['level']
      system = normalize_segment(system)

      errors = []
      errors << "système « #{system} » invalide" unless SYSTEMS.include?(system)
      errors << 'type vide après normalisation' if type.empty?
      errors << 'zone vide après normalisation' if zone.empty?
      errors << "niveau « #{level} » invalide" unless LEVELS.include?(level)
      unless errors.empty?
        UI.messagebox("Impossible de générer un nom valide :\n- #{errors.join("\n- ")}")
        return nil
      end

      { 'system' => system, 'type' => type, 'zone' => zone, 'level' => level }
    end

    # Zones déjà utilisées dans le modèle (extraites des noms conformes existants).
    def self.existing_zones(model)
      zones = []
      each_named_entity(model.entities) do |e|
        p = parse(e.name)
        zones << p[:zone] if p
      end
      zones.uniq
    end

    # --- Vérification du modèle (repère le « bloc unique » / noms fautifs) -----

    def self.validate_model
      model = Sketchup.active_model
      checked = 0
      invalid = []

      each_named_entity(model.entities) do |e|
        name = e.name.to_s
        must = carries_geometry?(e) || name.include?('__')
        next unless must
        checked += 1
        invalid << e unless NODE_NAME_REGEX.match?(name)
      end

      if checked.zero?
        UI.messagebox("Aucun groupe/composant porteur de géométrie trouvé.\n\n" \
                      "Si ta maison est un seul bloc, regroupe chaque élément " \
                      "dans son propre groupe avant de nommer.")
        return
      end

      if invalid.empty?
        UI.messagebox("✅ #{checked} objet(s) vérifié(s) : tous les noms sont conformes.")
        return
      end

      # Sélectionne les fautifs pour faciliter la correction + détaille en console.
      model.selection.clear
      model.selection.add(invalid)
      puts "[Home Designer] #{invalid.size}/#{checked} nom(s) non conforme(s) :"
      invalid.each do |e|
        n = e.name.to_s
        reason = n.empty? ? 'sans nom (exporté en « Geom3D », rejeté)' : diagnose(n)
        puts "  - #{n.empty? ? '(vide)' : n} → #{reason}"
      end

      UI.messagebox(
        "⚠ #{invalid.size}/#{checked} objet(s) non conforme(s).\n\n" \
        "Ils sont maintenant SÉLECTIONNÉS. Détails dans la Console Ruby " \
        "(Fenêtre > Console Ruby). Corrige-les avec « Nommer la sélection… »."
      )
    end

    # Diagnostic lisible d'un nom non conforme (miroir simplifié de validateNodeName).
    def self.diagnose(name)
      reasons = []
      reasons << 'majuscules' if name =~ /[A-Z]/
      reasons << 'accents'    if name =~ /[À-ÿ]/
      reasons << 'espaces'    if name =~ /\s/
      seg = name.split('__')
      if seg.size != 5
        reasons << "#{seg.size} segment(s) au lieu de 5"
      else
        reasons << "système « #{seg[0]} » inconnu" unless SYSTEMS.include?(normalize_segment(seg[0]))
        reasons << 'type vide' if seg[1].to_s.empty?
        reasons << 'zone vide' if seg[2].to_s.empty?
        reasons << "niveau « #{seg[3]} » inconnu" unless LEVELS.include?(normalize_segment(seg[3]))
        reasons << "index « #{seg[4]} » (3 chiffres attendus)" unless seg[4] =~ /\A\d{3}\z/
      end
      reasons.empty? ? 'non conforme' : reasons.join(', ')
    end

    # --- Menus -----------------------------------------------------------------

    unless defined?(@menu_loaded) && @menu_loaded
      menu = UI.menu('Extensions').add_submenu('Home Designer')
      menu.add_item('Nommer la sélection…') { name_selection }
      menu.add_item('Vérifier les noms du modèle') { validate_model }

      # Accès rapide par clic droit sur une sélection de groupes/composants.
      UI.add_context_menu_handler do |context_menu|
        sel = Sketchup.active_model.selection.to_a
        if sel.any? { |e| e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance) }
          context_menu.add_item('Home Designer — Nommer…') { name_selection }
        end
      end

      @menu_loaded = true
    end
  end
end
