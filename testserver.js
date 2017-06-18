

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var redis = require('redis');
var redisStore = require('connect-redis')(session);
var jsonfile = require('jsonfile');
var http = require('http');


var client_id = '4b5c02f8015941729381891f20c6f2a1'; // Your client id
var client_secret = '2448387e7977426ca1b70ef5da956300'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

var clientJSON = '{"clients":{}}';
var activeClients = '{"active":{}}';

var client = redis.createClient();


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


app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
  secret: client_secret,
  store: new redisStore({
    host: 'localhost', 
    port: '9999',
    client: client,
    ttl: 30 }),
  saveUninitialized: false,
  resave: false
}));

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

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        request.get(options, function(error, response, body){
           if(body.display_name)
           {
              req.session.name = body.display_name;
              //console.log(req.session.name + " inside if statements"); 
           }
           else
           {
              req.session.name = body.id;
              //console.log(req.session.name);
           }
        }); 

        



       
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

        //console.log(req.session.name + " session test 4343434");

        
  
});

app.post('/updateJSON', function(req, res){

  var obj = JSON.parse(clientJSON);
  var currentUser = req.body.userName;
  obj.clients[currentUser] = req.body;
  clientJSON = JSON.stringify(obj);
  //store.destroy(req.sessionID, function(error, data){
    //console.log(req.session.name + "check sessions");
  //});
});

app.get('/getJSON', function(req, res){
  res.json(clientJSON);
})

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


console.log('Listening on 8888');


var server = http.createServer(app);
server.listen(8888);
server.once('connection', function(socket){
  var clientConn;
  var client__fd = socket.fd;
  //console.log(client__fd + " cleint fd");
  app.post('/addActiveUser', function(req, res){
    if(req.body.userNameData)
    {
       var obj = {active: []};
      file = 'activeClients.json';
      clientConn = req.body.userNameData;
      obj.active.push({client: clientConn});
      var json = JSON.stringify(obj);
      jsonfile.writeFile(file, json, {flag: 'a'},function (err){
        //console.error(err);
      });
    }
   
    //var obj = JSON.parse(activeClients);
    //obj.active[clientConn] = clientConn;
    //activeClients = JSON.stringify(obj);
    //console.log(clientConn + " connected " + activeClients);
    console.log(clientConn + " bdjfksjf");
  });
  socket.once('disconnect',function(){
    //var obj = JSON.parse(activeClients);
    //delete obj.active[clientConn];
    //activeClients = JSON.stringify(obj);
     console.log(clientConn + " disconnected ");
     process.nextTick(socket.destroy());
  }); 
});  
