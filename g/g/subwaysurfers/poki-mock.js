(function () {
    var resolved = function () { return Promise.resolve(true); };
    var noop = function () {};

    window.PokiSDK = {
        _skipVideo: true,
        init: resolved,
        commercialBreak: resolved,
        rewardedBreak: resolved,
        getLeaderboard: function () { return Promise.resolve({}); },
        setDebug: noop,
        gameLoadingStart: noop,
        gameLoadingProgress: noop,
        gameLoadingFinished: noop,
        gameInteractive: noop,
        gameplayStart: noop,
        gameplayStop: noop,
        roundStart: noop,
        roundEnd: noop,
        happyTime: noop,
        customEvent: noop,
        displayAd: noop,
        destroyAd: noop
    };
})();
