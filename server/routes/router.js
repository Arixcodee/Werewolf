const express = require('express');
const router = express.Router({ strict: true });
const path = require('path');

router.get('/', function (request, response) {
    response.sendFile(path.join(__dirname, '../../client/src/views/home.html'));
});

router.get('/create', function (request, response) {
    response.sendFile(path.join(__dirname, '../../client/src/views/create.html'));
});

router.get('/game/:code', function (request, response) {
    response.sendFile(path.join(__dirname, '../../client/src/views/game.html'));
});


module.exports = router;
