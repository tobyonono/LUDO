

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var jsonfile = require('jsonfile');
var http = require('http');
var cheerio = require('cheerio');


var client_id = '4b5c02f8015941729381891f20c6f2a1'; // Your client id
var client_secret = '2448387e7977426ca1b70ef5da956300'; // Your secret
var redirect_uri = 'https://protected-coast-38333.herokuapp.com/callback'; // Your redirect uri

var clientJSON = '{"clients":[], "songProgress":[]}';
var activeClients = '{"active":[]}';



/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);



app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // application requests authorization
  var scope = 'user-read-private user-read-email user-read-currently-playing user-read-playback-state user-library-modify user-modify-playback-state ';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});


app.get('/callback', function(req, res) {

  // application requests refresh and access tokens
  // after checking the state parameter
  var name;
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;
  

  if (state === null || state !== storedState) 
  {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } 
  else 
  {
    res.clearCookie(stateKey);
    var authOptions = 
    {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: 
      {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) 
      {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;
     
        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
     
});

app.post('/updateJSON', function(req, res){

  var obj = JSON.parse(clientJSON);
  var exists = false;
  var user = req.body.userName;
  var progress = req.body.songProgress;

  if(obj.clients.length === 0)
  {
    delete obj.clients.songProgress;
    delete req.body.songProgress;
    obj.clients.push(req.body);
    obj.songProgress.push({userName:user, songProgress:progress});
  }
  else if(obj.clients.length > 0)
  {
    for(var i = 0; i < obj.clients.length; i++)
    {
      if(obj.clients[i].userName == user)
      {
        delete obj.clients.songProgress;
        delete req.body.songProgress;
        obj.clients[i] = req.body;
        exists = true;

        obj.songProgress[i] = {userName:user, songProgress:progress};
      }
    }

    if(exists == false)
    {
      delete obj.clients.songProgress;
      delete req.body.songProgress;
      obj.clients.push(req.body);
      obj.songProgress.push({userName:user, songProgress:progress});  
    }
  }
  clientJSON = JSON.stringify(obj);
  console.log(clientJSON);
  res.sendStatus(200)
});

app.get('/getJSON', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  res.json(clientJSON);
});

app.get('/showLive', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  res.json(activeClients);
});

app.get('/checkActive', function(req, res){
  var active = false;
  var obj = JSON.parse(activeClients);
  var user = req.body.user;
  console.log(user);
  for(var i = 0; i < obj.active.length; i++)
    {
      if(obj.active[i].userNameData == user)
      {
        obj.active[i] = req.body;
        active = true;
      }
    }

  var result = {'active': active};
  res.send(JSON.stringify(result));
  console.log(result);
});


app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });

  console.log("token refreshed");
});

app.post('/updateUserStatus', function(req, res){
  var obj = JSON.parse(activeClients);
  var currentUser = req.body.userNameData;
  var live = req.body.active;
  var freshUser = false;

  if(live)
  {
    for(var i = 0; i < obj.active.length; i++)
    {
      if(obj.active[i].userNameData == currentUser)
      {
        obj.active[i] = req.body;
        freshUser = true;
      }
    }
    if(freshUser == false)
    {
      obj.active.push(req.body);
    }   
  }

  else if(!live)
  {
    for(var i = 0; i < obj.active.length; i++)
    {
      if(obj.active[i].userNameData == currentUser)
      {
        obj.active[i] = req.body;
      }
    }
  }
  else
  {
    for(var i = 0; i < obj.active.length; i++)
    {
      if(!obj.active[i].userNameData)
      {
        obj.active.splice(i, 1);
      }
    }
  }
  
  activeClients = JSON.stringify(obj);
  console.log(activeClients);
  res.sendStatus(200)
});


console.log('Listening on 8888');
server.listen(process.env.PORT || 8888);


