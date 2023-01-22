// TODO: clean up these deep relative paths? jsconfig.json is not working...
const Game = require('../../../../server/model/Game');
const globals = require('../../../../server/config/globals');
const USER_TYPES = globals.USER_TYPES;
const STATUS = globals.STATUS;
const GameManager = require('../../../../server/modules/singletons/GameManager.js');
const TimerManager = require('../../../../server/modules/singletons/TimerManager.js');
const EventManager = require('../../../../server/modules/singletons/EventManager.js');
const logger = require('../../../../server/modules/Logger.js')(false);

describe('GameManager', () => {
    let gameManager, timerManager, eventManager, namespace, socket, game;

    beforeAll(() => {
        spyOn(logger, 'debug');
        spyOn(logger, 'error');

        const inObj = { emit: () => {} };
        namespace = { in: () => { return inObj; }, to: () => { return inObj; } };
        socket = { id: '123', emit: () => {}, to: () => { return { emit: () => {} }; } };
        gameManager = GameManager.instance ? GameManager.instance : new GameManager(logger, globals.ENVIRONMENT.PRODUCTION, 'test');
        timerManager = TimerManager.instance ? TimerManager.instance : new TimerManager(logger, 'test');
        eventManager = EventManager.instance ? EventManager.instance : new EventManager(logger, 'test');
        eventManager.publisher = { publish: async (...a) => {} };
        gameManager.eventManager = eventManager;
        gameManager.timerManager = timerManager;
        gameManager.setGameSocketNamespace(namespace);
        spyOn(gameManager, 'refreshGame').and.callFake(async () => {});
        spyOn(eventManager.publisher, 'publish').and.callFake(async () => {});
    });

    beforeEach(() => {
        spyOn(namespace, 'to').and.callThrough();
        spyOn(socket, 'to').and.callThrough();
        timerManager.timerThreads = {};
        game = new Game(
            'ABCD',
            STATUS.LOBBY,
            [{ id: 'a', name: 'person1', assigned: true, out: true, killed: false, userType: USER_TYPES.MODERATOR },
                { id: 'b', name: 'person2', gameRole: 'Villager', alignment: 'good', assigned: false, out: false, killed: false, userType: USER_TYPES.PLAYER }],
            [{ quantity: 2 }],
            false,
            'a',
            true,
            'a',
            new Date().toJSON(),
            null
        );
        game.currentModeratorId = 'a';
    });

    describe('#joinGame', () => {
        it('should mark the game as full when all players have been assigned', async () => {
            await gameManager.joinGame(game, 'Jill', 'x');

            expect(game.isFull).toEqual(true);
        });

        it('should create a spectator if the game is already full and broadcast it to the room', () => {
            game.people.find(p => p.id === 'b').assigned = true;
            game.isFull = true;
            spyOn(gameManager.namespace.in(), 'emit');

            gameManager.joinGame(game, 'Jane', 'x');

            expect(game.isFull).toEqual(true);
            expect(game.people.filter(p => p.userType === USER_TYPES.SPECTATOR).length).toEqual(1);
        });
    });

    describe('#restartGame', () => {
        let shuffleSpy;

        beforeEach(() => {
            shuffleSpy = spyOn(gameManager, 'shuffle').and.stub();
        });

        it('should reset all relevant game parameters', async () => {
            game.status = STATUS.ENDED;
            const player = game.people.find(p => p.id === 'b');
            player.userType = USER_TYPES.KILLED_PLAYER;
            player.killed = true;
            player.out = true;
            const emitSpy = spyOn(namespace.in(), 'emit');

            await gameManager.restartGame(game, namespace);

            expect(game.status).toEqual(STATUS.IN_PROGRESS);
            expect(player.userType).toEqual(USER_TYPES.PLAYER);
            expect(player.out).toBeFalse();
            expect(player.killed).toBeFalse();
            expect(shuffleSpy).toHaveBeenCalled();
            expect(emitSpy).toHaveBeenCalledWith(globals.EVENT_IDS.RESTART_GAME);
        });

        it('should reset all relevant game parameters, including when the game has a timer', async () => {
            game.timerParams = { hours: 2, minutes: 2, paused: false };
            game.hasTimer = true;
            timerManager.timerThreads = { ABCD: { kill: () => {} } };
            game.status = STATUS.ENDED;

            const threadKillSpy = spyOn(timerManager.timerThreads.ABCD, 'kill');
            const runTimerSpy = spyOn(timerManager, 'runTimer').and.stub();
            const emitSpy = spyOn(namespace.in(), 'emit');

            await gameManager.restartGame(game, namespace);

            expect(game.status).toEqual(STATUS.IN_PROGRESS);
            expect(game.timerParams.paused).toBeTrue();
            expect(threadKillSpy).toHaveBeenCalled();
            expect(runTimerSpy).toHaveBeenCalled();
            expect(shuffleSpy).toHaveBeenCalled();
            expect(emitSpy).toHaveBeenCalledWith(globals.EVENT_IDS.RESTART_GAME);
        });

        it('should reset all relevant game parameters and create a temporary moderator', async () => {
            const emitSpy = spyOn(namespace.in(), 'emit');
            game.currentModeratorId = 'b';
            game.people.find(p => p.id === 'a').userType = USER_TYPES.SPECTATOR;
            game.moderator = game.people[0];
            game.people.find(p => p.id === 'b').userType = USER_TYPES.MODERATOR;
            game.hasDedicatedModerator = false;

            await gameManager.restartGame(game, namespace);

            expect(game.status).toEqual(STATUS.IN_PROGRESS);
            expect(game.currentModeratorId).toEqual('b');
            expect(game.people.find(p => p.id === 'b').userType).toEqual(USER_TYPES.TEMPORARY_MODERATOR);
            expect(shuffleSpy).toHaveBeenCalled();
            expect(emitSpy).toHaveBeenCalledWith(globals.EVENT_IDS.RESTART_GAME);
        });
    });
});
