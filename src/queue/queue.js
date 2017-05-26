define('FarmOverflow/Queue', [
    'conf/unitTypes',
    'helper/time',
    'helper/math'
], function (UNITS, $timeHelper, $math) {
    let errorCallback = function () {}

    let i18n = $filter('i18n')
    let readableMillisecondsFilter = $filter('readableMillisecondsFilter')
    let readableDateFilter = $filter('readableDateFilter')

    let queue = []
    let index = 0

    function joinTroopsLog (units) {
        var troops = []

        for (unit in units) {
            troops.push(`${unit}: ${units[unit]}`)
        }

        return troops.join(',')
    }

    function joinOfficersLog (officers) {
        var string = []

        for (var officer in officers) {
            string.push(officer)
        }

        return string.join(', ')
    }

    function updateVillageData (command, prop) {
        let coords = command[prop].coords.split('|').map(function (coord) {
            return parseInt(coord, 10)
        })

        $autoCompleteService.villageByCoordinates({
            x: coords[0],
            y: coords[1]
        }, function (villageData) {
            command[prop].id = villageData.id
            command[prop].name = villageData.name
        })
    }

    function checkCoords (xy) {
        return /\d{3}\|\d{3}/.test(xy)
    }

    function checkUnits (units) {
        for (var unit in units) {
            if (units[unit] == 0) {
                return false
            }
        }

        return true
    }

    function checkArriveTime (sendTime) {
        if ($timeHelper.gameTime() > sendTime) {
            return false
        }

        return true
    }

    function orderQueue () {
        queue = queue.sort(function (a, b) {
            return a.sendTime - b.sendTime
        })
    }

    function getTravelTime (origin, target, units, type, officers) {
        var army = {
            units: units,
            officers: officers
        }

        var travelTime = $armyService.calculateTravelTime(army, {
            barbarian: false,
            ownTribe: false,
            officers: officers,
            effects: false
        })

        origin = origin.split('|')
        target = target.split('|')

        let distance = $math.actualDistance({
            x: origin[0],
            y: origin[1]
        }, {
            x: target[0],
            y: target[1]
        })

        let totalTravelTime = $armyService.getTravelTimeForDistance(
            army,
            travelTime,
            distance,
            type
        )

        return totalTravelTime * 1000
    }

    function sendCommand (command) {
        $socket.emit($route.SEND_CUSTOM_ARMY, {
            start_village: command.origin.id,
            target_village: command.target.id,
            type: command.type,
            units: command.units,
            icon: 0,
            officers: command.officers,
            catapult_target: null
        })

        console.log('============= planeador =============')
        console.log('ataque #' + command.id + ' enviado')

        console.log({
            start_village: command.origin.id,
            target_village: command.target.id,
            type: command.type,
            units: command.units,
            icon: 0,
            officers: command.officers,
            catapult_target: null
        })
    }

    function onError (fn) {
        errorCallback = fn
    }

    // function add (origin, target, units, arrive, type, officers) {
    function add (command) {
        if (!command.origin || !command.target) {
            return errorCallback('Origin/target has errors.')
        }

        if (!checkCoords(command.origin)) {
            return errorCallback(`Origin coords format ${origin} is invalid.`)
        }

        if (!checkCoords(command.target)) {
            return errorCallback(`Origin coords format ${target} is invalid.`)
        }

        if (!checkUnits(command.units)) {
            return errorCallback('Unit amount can not be zero.')
        }

        var arriveTime = new Date(command.arrive).getTime()
        var travelTime = getTravelTime(command.origin, command.target, command.units, command.type)
        var sendTime = arriveTime - travelTime

        if (!checkArriveTime(sendTime)) {
            return errorCallback('This command should have already exited.')
        }

        // transform "true" to 1 because the game do like that
        for (let officer in command.officers) {
            command.officers[officer] = 1
        }

        command.id = index++
        command.sendTime = sendTime
        command.travelTime = travelTime
        command.origin = { coords: command.origin, name: null, id: null }
        command.target = { coords: command.target, name: null, id: null }

        updateVillageData(command, 'origin')
        updateVillageData(command, 'target')

        queue.push(command)
        orderQueue()
    }

    function show (_id) {
        var gameTime = $timeHelper.gameTime()

        // var commandsTable = {}

        for (var i = 0; i < queue.length; i++) {
            var cmd = queue[i]

            if (_id && _id != cmd.id) {
                continue
            }
            
            var troops = joinTroopsLog(cmd.units)
            var officers = joinOfficersLog(cmd.officers)
            var $travelTime = readableMillisecondsFilter(cmd.travelTime)
            var $sendTime = readableDateFilter(cmd.sendTime)
            var $arrive = readableDateFilter(cmd.sendTime + cmd.travelTime)
            var $remain = readableMillisecondsFilter(cmd.sendTime - gameTime)

            console.log(`%c============= planeador.show #${cmd.id} =============`, 'background:#ccc')
            console.log(`Identificação:  ${cmd.id}`)
            console.log(`Saida em:       ${$remain}`)
            console.log(`Duração:        ${$travelTime}`)
            console.log(`Envio:          ${$sendTime}`)
            console.log(`Chegada:        ${$arrive}`)
            console.log(`Origem:         ${cmd.origin.name} (${cmd.origin.coords})`)
            console.log(`Alvo:           ${cmd.target.name} (${cmd.target.coords})`)
            console.log(`Tropas:         ${troops}`)
            console.log(`Oficiais:       ${officers}`)
            console.log(`Tipo:           ${cmd.type}`)

            // commandsTable[cmd.id] = {
            //     'Saida em': $remain,
            //     'Duração': $travelTime,
            //     'Envio': $sendTime,
            //     'Chegada': $arrive,
            //     'Origem': `${cmd.target.name} (${cmd.target.coords})`,
            //     'Alvo': `${cmd.target.name} (${cmd.target.coords})`,
            //     'Tropas': troops,
            //     'Oficiais': officers,
            //     'Tipo': cmd.type
            // }
        }

        // console.table(commandsTable)
    }

    function remove (id) {
        console.log('%c============= planeador.remove =============', 'background:#ccc')

        for (var i = 0; i < queue.length; i++) {
            if (queue[i].id == id) {
                console.log('ataque #' + id + ' removido!')
                
                queue.splice(i, i + 1)
                return
            }
        }

        console.log('nenhum ataque removido!')
    }

    function listener () {
        setInterval(function () {
            var gameTime = $timeHelper.gameTime()
            var command
            var i

            if (!queue.length) {
                return false
            }

            for (i = 0; i < queue.length; i++) {
                if (queue[i].sendTime - gameTime < 0) {
                    sendCommand(queue[i])
                } else {
                    break
                }
            }

            if (i) {
                queue.splice(0, i)
            }
        }, 150)
    }

    // listener()

    return {
        version: '0.1.0',
        add: add,
        show: show,
        remove: remove,
        onError: onError
    }
})