

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
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

var clientJSON = '{"clients":[]}';
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

  // your application requests authorization
  var scope = 'user-read-private user-read-email user-read-currently-playing';
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

  // your application requests refresh and access tokens
  // after checking the state parameter
  var name;
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;
  //console.log(req.cookies[stateKey] + "jsdjksdb");

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
  for(var i = 0; i < obj.clients.length; i++)
    {
      if(obj.clients[i].username == req.body.username)
      {
        obj.clients[i] = req.body;
        exists = true;
      }
    }

    if(exists == false){
      obj.clients.push(req.body);
    }
  
  clientJSON = JSON.stringify(obj);
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
  var obj = JSON.parse(activeClients);
  var currentUser = req.body.userNameData;
  var live = req.body.active;
  var inArray = false;
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
server.listen(8888);


