define('FarmOverflow/FarmInterface', [
    'helper/time',
    'FarmOverflow/Interface',
    'FarmOverflow/FrontButton'
], function ($timeHelper, Interface, FrontButton) {
    return function (farmOverflow) {
        /**
         * Loop em todas configurações do FarmOverflow
         * @param {Function} callback
         */
        function eachSetting (callback) {
            for (var key in farmOverflow.settings) {
                var $input = $('[name="' + key + '"]', farmInterface.$window)

                if (!$input.length) {
                    continue
                }

                callback($input)
            }
        }

        /**
         * Listeners das para alteração das configurações do FarmOverflow.
         */
        function bindSettings () {
            // Insere os valores nas entradas
            eachSetting(function ($input) {
                var type = $input[0].type
                var name = $input[0].name

                if (type === 'select-one') {
                    if (name === 'language') {
                        $input[0].value = farmOverflow.settings.language
                    }

                    return
                }

                if (type === 'checkbox') {
                    if (farmOverflow.settings[name]) {
                        $input[0].checked = true
                        $input.parent().addClass(inputCheckedClass)
                    }

                    $input.on('click', function () {
                        $input.parent().toggleClass(inputCheckedClass)
                    })

                    return
                }

                $input.val(farmOverflow.settings[name])
            })

            // Quarda os valores quando salvos
            $settings.on('submit', function (event) {
                event.preventDefault()

                if ($settings[0].checkValidity()) {
                    var settings = {}

                    eachSetting(function ($input) {
                        var name = $input[0].name
                        var type = $input[0].type
                        var value = $input.val()

                        if ($input[0].type === 'number') {
                            value = parseInt(value, 10)
                        }

                        settings[name] = value
                    })

                    farmOverflow.updateSettings(settings)

                    if (farmOverflow.notifsEnabled) {
                        emitNotif('success', farmOverflow.lang.settings.saved)
                    }
                }

                return false
            })

            $save.on('click', function (event) {
                $settings.find('input:submit')[0].click()
            })
        }

        /**
         * Adiciona eventos na interface com base nos eventos do FarmOverflow.
         */
        function bindEvents () {
            var settings = farmOverflow.settings

            var listenEvents = {
                sendCommand: function (from, to) {
                    $status.html(farmOverflow.lang.events.attacking)
                    updateLastAttack($timeHelper.gameTime())

                    if (!settings.eventAttack) {
                        return false
                    }

                    var labelFrom = from.name + ' (' + from.x + '|' + from.y + ')'
                    var labelTo = to.name + ' (' + to.x + '|' + to.y + ')'

                    addEvent({
                        links: [
                            { type: 'village', name: labelFrom, id: from.id },
                            { type: 'village', name: labelTo, id: to.id }
                        ],
                        icon: 'attack-small',
                        type: 'sendCommand'
                    })
                },
                nextVillage: function (next) {
                    updateSelectedVillage()
                    
                    if (!settings.eventVillageChange) {
                        return false
                    }

                    var label = next.name + ' (' + next.x + '|' + next.y + ')'

                    addEvent({
                        links: [
                            { type: 'village', name: label, id: next.id }
                        ],
                        icon: 'village',
                        type: 'nextVillage'
                    })
                },
                ignoredVillage: function (target) {
                    if (!settings.eventIgnoredVillage) {
                        return false
                    }

                    var label = target.name + ' (' + target.x + '|' + target.y + ')'

                    addEvent({
                        links: [
                            { type: 'village', name: label, id: target.id }
                        ],
                        icon: 'check-negative',
                        type: 'ignoredVillage'
                    })
                },
                priorityTargetAdded: function (target) {
                    if (!settings.eventPriorityAdd) {
                        return false
                    }
                    
                    var label = target.name + ' (' + target.x + '|' + target.y + ')'

                    addEvent({
                        links: [
                            { type: 'village', name: label, id: target.id }
                        ],
                        icon: 'parallel-recruiting',
                        type: 'priorityTargetAdded'
                    })
                },
                noPreset: function () {
                    addEvent({
                        icon: 'info',
                        type: 'noPreset'
                    })

                    $status.html(farmOverflow.lang.events.paused)
                },
                noUnits: function () {
                    if (farmOverflow.singleVillage) {
                        $status.html(farmOverflow.lang.events.noUnits)
                    }
                },
                noUnitsNoCommands: function () {
                    $status.html(farmOverflow.lang.events.noUnitsNoCommands)
                },
                start: function () {
                    $status.html(farmOverflow.lang.events.attacking)
                },
                pause: function () {
                    $status.html(farmOverflow.lang.events.paused)
                },
                noVillages: function () {
                    $status.html(farmOverflow.lang.events.noVillages)
                },
                villagesUpdate: function () {
                    updateSelectedVillage()
                },
                startLoadingTargers: function () {
                    $status.html(farmOverflow.lang.events.loadingTargets)
                },
                endLoadingTargers: function () {
                    $status.html(farmOverflow.lang.events.analyseTargets)
                },
                attacking: function () {
                    $status.html(farmOverflow.lang.events.attacking)
                },
                commandLimitSingle: function () {
                    $status.html(farmOverflow.lang.events.commandLimit)
                },
                commandLimitMulti: function () {
                    $status.html(farmOverflow.lang.events.noVillages)
                },
                resetEvents: function () {
                    visibleEventCount = 0
                    populateEvents()
                }
            }

            for (var e in listenEvents) {
                farmOverflow.on(e, listenEvents[e])
            }
        }

        /**
         * Atualiza o elemento com a data do último ataque enviado
         * Tambem armazena para ser utilizado nas proximas execuções.
         */
        function updateLastAttack (lastAttack) {
            if (!lastAttack) {
                lastAttack = farmOverflow.lastAttack

                if (lastAttack === -1) {
                    return
                }
            }

            var readable = $filter('readableDateFilter')(lastAttack)
            var langLast = farmOverflow.lang.events.lastAttack

            $last.html(readable)
            updateQuickview()
        }

        /**
         * Adiciona um evento na aba "Eventos".
         *
         * @param {Object} options - Opções do evento.
         * @param {Boolean} [_populate] - Indica quando o script está apenas populando
         *      a lista de eventos, então não é alterado o "banco de dados".
         */
        function addEvent (options, _populate) {
            var limit = farmOverflow.settings.eventsLimit

            if (visibleEventCount >= limit) {
                $events.find('tr:last-child').remove()
            }

            if (events.length >= limit) {
                events.pop()
            }

            addRow($events, options, _populate)
            visibleEventCount++

            if (!_populate) {
                options.timestamp = $timeHelper.gameTime()
                events.unshift(options)
                
                Lockr.set('farm-lastEvents', events)
            }
        }

        /**
         * Adiciona uma linha (tr) com links internos do jogo.
         *
         * @param {Object} options
         * @param {Boolean} [_populate] - Indica quando o script está apenas populando
         *      a lista de eventos, então os elementos são adicionados no final da lista.
         */
        function addRow ($where, options, _populate) {
            var links = []

            // Copia o objeto porque ele será armazenado e não queremos os
            // dados guardados já renderizados.
            options = angular.copy(options)

            if (options.links) {
                for (var i = 0; i < options.links.length; i++) {
                    links.push(createButtonLink(
                        options.links[i].type,
                        options.links[i].name
                    ))
                }

                if (!options.type) {
                    options.text = sprintf(options.text, links)
                } else {
                    options.text = sprintf(farmOverflow.lang.events[options.type], links)
                }
            }

            var $tr = document.createElement('tr')

            $tr.className = 'reduced'
            $tr.innerHTML = TemplateEngine('___htmlFarmEvent', {
                date: $filter('readableDateFilter')(options.timestamp || $timeHelper.gameTime()),
                icon: options.icon,
                text: options.text
            })

            if (!options.icon) {
                $tr.querySelector('.icon-bg-black').remove()
                $tr.querySelector('.text-tribe-news').className = ''
            }

            if (options.links) {
                for (var i = 0; i < links.length; i++) {
                    options.links[i].elem = $tr.querySelector('#' + links[i].id)
                    options.links[i].elem.addEventListener('click', function () {
                        $wds.openVillageInfo(options.links[i].id)
                    })
                }
            }

            $where[_populate ? 'append' : 'prepend']($tr)
            farmInterface.$scrollbar.recalc()
        }

        /**
         * Atualiza o elemento com a aldeias atualmente selecionada
         */
        function updateSelectedVillage () {
            var selected = farmOverflow.village

            if (!selected) {
                $selected.html(farmOverflow.lang.general.none)

                return false
            }

            var village = createButtonLink(
                'village',
                selected.name + ' (' + selected.x + '|' + selected.y + ')',
                farmOverflow.village.id
            )

            $selected.html('')
            $selected.append(village.elem)
        }

        /**
         * Popula a lista de eventos que foram gerados em outras execuções
         * do FarmOverflow.
         */
        function populateEvents () {
            var settings = farmOverflow.settings
            
            // Caso tenha algum evento, remove a linha inicial "Nada aqui ainda"
            if (events.length > 0) {
                $events.html('')
            }

            for (var i = 0; i < events.length; i++) {
                if (visibleEventCount >= settings.eventsLimit) {
                    break
                }

                var event = events[i]

                if (!settings.eventAttack && event.type === 'sendCommand') {
                    continue
                }

                if (!settings.eventVillageChange && event.type === 'nextVillage') {
                    continue
                }

                if (!settings.eventPriorityAdd && event.type === 'priorityTargetAdded') {
                    continue
                }

                if (!settings.eventIgnoredVillage && event.type === 'ignoredVillage') {
                    continue
                }

                addEvent(event, true)
            }
        }

        /**
         * Atualiza a lista de grupos na aba de configurações.
         */
        function updateGroupList () {
            var types = ['groupIgnore', 'groupInclude', 'groupOnly']
            var groups = $model.getGroupList().getGroups()

            for (var type in $groups) {
                $groups[type].html(
                    '<option value="">' + farmOverflow.lang.general.disabled + '</option>'
                )

                for (var id in groups) {
                    var name = groups[id].name
                    var selected = ''

                    if (farmOverflow.settings[type] == id) {
                        selected = 'selected'
                    }

                    $groups[type].append(
                        '<option value="' + id + '" ' + selected + '>' + name + '</option>'
                    )
                }
            }
        }

        /**
         * Atualiza a lista de presets na aba de configurações.
         */
        function updatePresetList () {
            var loaded = {}
            var presets = $model.getPresetList().presets
            
            $preset.html(
                '<option value="">' + farmOverflow.lang.general.disabled + '</option>'
            )

            for (var id in presets) {
                var cleanName = presets[id].name.replace(rpreset, '').trim()

                if (cleanName in loaded) {
                    continue
                }

                // presets apenas com descrição sem identificação são ignorados
                if (!cleanName) {
                    continue
                }

                var selected = ''

                if (farmOverflow.settings.presetName === cleanName) {
                    selected = 'selected'
                }

                $preset.append(
                    '<option value="' + cleanName + '" ' + selected + '>' + cleanName + '</option>'
                )

                loaded[cleanName] = true
            }
        }

        function updateQuickview () {
            var last = farmOverflow.lang.events.lastAttack
            
            return last + ': ' + $last.html()
        }

        var farmInterface = new Interface('farmOverflow-farm', {
            activeTab: 'info',
            htmlTemplate: '___htmlFarmWindow',
            htmlReplaces: angular.merge({
                version: farmOverflow.version,
                author: ___author
            }, farmOverflow.lang)
        })

        var farmButton = new FrontButton({
            label: 'Farm',
            classHover: 'expand-button',
            classBlur: 'contract-button',
            hoverText: updateQuickview
        })

        var $window = $(farmInterface.$window)

        var $settings = $window.find('.settings')
        var $save = $window.find('.save')
        var $start = $window.find('.start')
        var $preset = $window.find('.preset')
        var $selected = $window.find('.selected')
        var $events = $window.find('.events')
        var $status = $window.find('.status')
        var $last = $window.find('.last')
        var $groups = {
            groupIgnore: $window.find('.ignore'),
            groupInclude: $window.find('.include'),
            groupOnly: $window.find('.only')
        }

        var events = Lockr.get('farm-lastEvents', [], true)
        var visibleEventCount = 1

        bindSettings()
        bindEvents()
        updateGroupList()
        updateSelectedVillage()
        updateLastAttack()
        populateEvents()

        if ($presetList.isLoaded()) {
            updatePresetList()
        }

        farmOverflow.on('groupsChanged', function () {
            updateGroupList()
        })

        farmOverflow.on('presetsLoaded', function () {
            updatePresetList()
        })

        farmOverflow.on('presetsChange', function () {
            updatePresetList()
        })

        farmButton.click(function () {
            farmInterface.openWindow()
        })

        $start.on('click', function () {
            farmOverflow.switch()
        })

        $hotkeys.add(farmOverflow.settings.hotkeySwitch, function () {
            farmOverflow.switch()
        })

        $hotkeys.add(farmOverflow.settings.hotkeyWindow, function () {
            farmInterface.openWindow()
        })

        farmOverflow.on('start', function () {
            $start.html(farmOverflow.lang.general.pause)
            $start.removeClass('btn-green').addClass('btn-red')
            farmButton.$elem.removeClass('btn-green').addClass('btn-red')
        })

        farmOverflow.on('pause', function () {
            $start.html(farmOverflow.lang.general.start)
            $start.removeClass('btn-red').addClass('btn-green')
            farmButton.$elem.removeClass('btn-red').addClass('btn-green')
        })
    }
})