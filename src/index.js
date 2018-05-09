/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/
//COLOSSAL CAVE ADVENTURE IMPLEMENTATION FOR ALEXA
'use strict';

const Alexa = require('alexa-sdk');

const LOCATIONS = require('./locations'),
	EVENT_MATRIX = require('./event-matrix'),
	ACTIONS = require('./actions'),
	OBJECT_STATUS = require('./object-status'),
	HINTS = require('./hints');

const GAME_STATES = {
	GAME: 'GAME', //start the game
	HELP: 'HELP' //the user is asking for help
}
//variables
var output = '';

var state = {
	currentLocation: 1,
	helpMoving: 0,
	helpObjects: 0
};

const HELP_MESSAGES = {
	START: 'WOULD YOU LIKE ME TO HELP YOU WITH MOVING OR OBJECTS?',
	MOVING : [
		'I KNOW OF PLACES, ACTIONS, AND THINGS. MOST OF MY VOCABULARY DESCRIBES PLACES AND IS USED TO MOVE YOU THERE. TO MOVE TRY WORDS LIKE FOREST, BUILDING, DOWNSTREAM, ENTER, EAST, WEST NORTH, SOUTH, UP, OR DOWN. USUALLY PEOPLE HAVING TROUBLE MOVING JUST NEED TO TRY A FEW MORE WORDS.',
		'TO SPEED THE GAME YOU CAN SOMETIMES MOVE LONG DISTANCES WITH A SINGLE WORD. FOR EXAMPLE, BUILDING USUALLY GETS YOU TO THE BUILDING FROM ANYWHERE ABOVE GROUND EXCEPT WHEN LOST IN THE FOREST. ALSO, NOTE THAT CAVE PASSAGES TURN A LOT, AND THAT LEAVING A ROOM TO THE NORTH DOES NOT GUARANTEE ENTERING THE NEXT FROM THE SOUTH. GOOD LUCK!'
		],
	OBJECTS : [
		'I KNOW ABOUT A FEW SPECIAL OBJECTS, LIKE A BLACK ROD HIDDEN IN THE CAVE. THESE OBJECTS CAN BE MANIPULATED USING ONE OF THE ACTION WORDS THAT I KNOW. USUALLY  YOU WILL NEED TO GIVE BOTH THE OBJECT AND ACTION WORDS (IN EITHER ORDER), BUT SOMETIMES I CAN INFER THE OBJECT FROM THE VERB ALONE. THE OBJECTS HAVE SIDE EFFECTS - FOR INSTANCE, THE ROD SCARES THE BIRD.',
		'USUALLY PEOPLE TRYING TO MANIPULATE AN OBJECT ARE ATTEMPTING SOMETHING BEYOND THEIR (OR MY!) CAPABILITIES AND SHOULD TRY A COMPLETELY DIFFERENT TACK.'
		],
	MORE: 'WOULD YOU LIKE TO HEAR MORE ABOUT ',
	RETURN: 'WOULD YOU LIKE TO RETURN TO THE GAME?'
}
const WELCOME_MESSAGE = 'WELCOME TO ADVENTURE!!  WOULD YOU LIKE INSTRUCTIONS?';
const LOST_MESSAGE = 'YOU ARE LOST IN THE FOREST.';
const STOP_MESSAGE = 'THANK YOU FOR PLAYING.';

const TRY_AGAIN_MESSAGE = 'PLEASE TRY AGAIN';

const UNHANDLED_MESSAGE = 'SORRY, I DIDN\'T UNDERSTAND THAT. TRY AGAIN OR SAY HELP FOR MORE ASSISTANCE';

var ITEM_LOCATIONS = [3,3,8,10,11,14,13,9,15,18,19,17,27,28,29,30,0,0,3,3]; /* 0 = in inventory; >0 = location*/
var ITEM_IS_IMMOVABLE =    [0,0,1, 0, 0, 1, 0,1, 1, 0, 1, 1, 0, 0, 0, 0,0,0,0,0]
var ACTION_VERB_DEFAULTS = [24,29,0,31,0,31,38,38,42,42,43,46,77,71,73,75] //2000 action verbs

/*intents
movePlayerIntent (move NSEW, up/down, through doors, etc)
interactItemIntent (pick up items)
interactWithItemIntent (take, release, pour)

*/

//handlers
//export handler
exports.handler = function(event, context, callback){
	context.logGroupName = 'CaveGameLogs';
	context.logStreamName = 'GameLogs';
	const alexa = Alexa.handler(event, context);
	alexa.registerHandlers(newSessionHandlers, gameStateHandlers, helpStateHandlers);
	alexa.execute();
};


const newSessionHandlers = {
	'LaunchRequest' : function(){
		//this.emit(':ask', WELCOME_MESSAGE);
		this.handler.state = GAME_STATES.GAME;
		this.emitWithState('moveToRoom', 1);
	},
	/*
	'AMAZON.YesIntent' : function(){
		if (output == ''){
			this.emit('AMAZON.HelpIntent');
		} else {
			this.emit('Unhandled');
		}
	},
	'AMAZON.NoIntent' : function(){
		if (output == ''){
			//start game
			this.handler.state = GAME_STATES.GAME;
			this.emitWithState('moveToRoom', 1);
		}
		else {
			this.emit('Unhandled');
		}
	},
	*/
	'AMAZON.HelpIntent': function () {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState('helpTheUser');
    },
    /*
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', STOP_MESSAGE);
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', STOP_MESSAGE);
    },
    'SessionEndedRequest': function () {
        this.emit(':tell', STOP_MESSAGE);
    },
    'Unhandled': function() {
        this.emit(':ask', UNHANDLED_MESSAGE);
    }
    */
};

const gameStateHandlers = Alexa.CreateStateHandler(GAME_STATES.GAME, {
	'lookAroundIntent': function(){
		this.handler.state = GAME_STATES.GAME;
		this.emitWithState('moveToRoom');
	},
	'moveToRoom' : function(newLocation){
		if (newLocation){
			state.currentLocation = newLocation; 	
		}
		output = LOCATIONS[state.currentLocation].long;

		let objectsHere = OBJECT_STATUS
			.filter(item => item.startLocation == state.currentLocation)
			.map(item => item.value);
		if(objectsHere){
			output += ' ' + objectsHere.join(' ');
		}

		//CHECK EVENT OPTIONS FOR THIS LOCATION
		let eventOptions = EVENT_MATRIX.find(event => event.current == state.currentLocation);
		if (eventOptions && eventOptions.events[0] === 1){
			state.currentLocation = eventOptions.next;
			output += LOCATIONS[state.currentLocation].long;
		}

		this.emit(':ask', output, HELP_MESSAGES.START);
	},
	'movePlayerIntent' : function(){
		let moveSuccessful = false,
			newLocation = state.currentLocation;
		const move = this.event.request.intent.slots.direction.value.toUpperCase();

		//GET EVENT OPTIONS FOR THIS LOCATION
		let eventOptions = EVENT_MATRIX.filter(event => event.current == state.currentLocation);
		let action = ACTIONS.find(action => action.key < 1000 && move.includes(action.value));

		if(action){
			let actionKey = action.key;
			//CHECK IF MOVE OPTION in MATRIX
			let viableOption = eventOptions.find(option => option.events.includes(actionKey));
			moveSuccessful = viableOption ? true : moveSuccessful;
			
			if(moveSuccessful){
				newLocation = viableOption.next;
				if(newLocation >= 300){
					output = LOCATIONS[newLocation - 300];
					this.emit(':ask', output, HELP_MESSAGES.START);
				} else {
					this.emitWithState('moveToRoom', newLocation);	
				}
			} else {
				output = LOCATIONS[state.currentLocation].short;
				if (!output){
					output = TRY_AGAIN_MESSAGE;
				}
				this.emit(':ask', output, HELP_MESSAGES.START);
			}
		}
		else {
			output = TRY_AGAIN_MESSAGE;
			this.emit(':ask', output, HELP_MESSAGES.START);
		}
	},
	'interactItemIntent' : function(){
		const item = this.event.request.intent.slots.item.value.toUpperCase();
		const itemAction = this.event.request.intent.slots.itemAction.value.toUpperCase();

		const itemActionKey = ACTIONS.find(action => action.key > 2000 && itemAction.includes(action.value));
		const itemKey = ACTIONS.find(action => action.key > 1000 && action.key < 2000 && item.includes(action.value));

		if (!itemActionKey){
			output = HINTS[60];
		}
		switch(itemActionKey.key){
			case 2001:
				output = HINTS[54];
				ITEM_LOCATIONS[item.key-1] = 0; //put in inventory
				//todo: you are already carrying it
				break;
			default:
				output = HINTS[12];
		}
		this.emit(':ask', output, HELP_MESSAGES.START);
		//this.emit(':ask', output + ' ' + itemActionKey.value + ' ' + itemKey.value, HELP_MESSAGES.START);
	},
	'takeItemIntent' : function(){
		const item = this.event.request.intent.slots.item.value.toUpperCase();
		const action = ACTIONS.find(action => action.key > 1000 && action.key < 2000 && item.includes(action.value));
		
		if (action){
			const itemLocation = ITEM_LOCATIONS[action.key-1001];
			if (itemLocation === 0){
				output = HINTS[24]; //YOU ARE ALREADY CARRYING IT!
			}
			else if (itemLocation === state.currentLocation){
				output = HINTS[54]; //OK
				ITEM_LOCATIONS[action.key-1001] = 0;
			} else {
				output = HINTS[12]; //I DON'T KNOW HOW TO APPLY THAT WORD HERE.
			}
		} else {
			output = HINTS[60] //I DON'T KNOW THAT WORD.
		}
		
		this.emit(':ask', output, HELP_MESSAGES.START);
	},
	'dropItemIntent' : function(){
		const item = this.event.request.intent.slots.item.value.toUpperCase();
		const action = ACTIONS.find(action => action.key > 1000 && action.key < 2000 && item.includes(action.value));
		if (action){
			const itemLocation = ITEM_LOCATIONS[action.key-1001];
			if (itemLocation === 0){
				output = HINTS[54]; //OK
				ITEM_LOCATIONS[action.key-1001] = state.currentLocation;
			} else {
				output = HINTS[29]; //YOU AREN'T CARRYING IT!
			}
		} else {
			output = HINTS[60] //I DON'T KNOW THAT WORD.
		}
			
		this.emit(':ask', output, HELP_MESSAGES.START);
	},
	//TAKE ITEM
	//DROP ITEM
	//LOCK
	//UNLOCK
	//LIGHT
	//EXTINQUISH
	//EAT
	//DRINK
	//ATTACK
	//pour/fill
	//bird
	'AMAZON.HelpIntent': function () {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState('helpTheUser');
    },
    'Unhandled': function() {
        this.emitWithState('moveToRoom');
    }
});

const helpStateHandlers = Alexa.CreateStateHandler(GAME_STATES.HELP, {
	'helpTheUser' : function(){
		output = HELP_MESSAGES.START;
		this.emit(':ask', output, output);
	},
	'helpTheUserWithMovement' : function(){
		output = HELP_MESSAGES.MOVING[state.helpMoving];
		if (state.helpMoving === 0){
			output += HELP_MESSAGES.MORE + 'MOVING?';
		} else {
			output += ' ' + HELP_MESSAGES.RETURN;
		}
		this.emit(':ask', output, output);
	},
	'helpTheUserWithObjects' : function(){
		output = HELP_MESSAGES.OBJECTS[state.helpObjects];
		if (state.helpObjects === 0){
			output += HELP_MESSAGES.MORE + 'OBJECTS?';	
		} else {
			output += ' ' + HELP_MESSAGES.RETURN;
		}
		this.emit(':ask', output, output);
	},
	'AMAZON.YesIntent' : function(){
		if (output.includes('MOVING')){
			state.helpMoving = 1;
			this.emitWithState('helpTheUserWithMovement');
		} else if (output.includes('OBJECTS')){
			state.helpObjects = 1;
			this.emitWithState('helpTheUserWithObjects');
		} else if (output.includes('RETURN')){
			this.handler.state = GAME_STATES.GAME;
			this.emitWithState('moveToRoom');
		}
	},
	'AMAZON.NoIntent' : function(){
		console.error(state.helpMoving);
		console.error(state.helpObjects);
		if (state.helpMoving + state.helpObjects > 0){
			console.error('to helptheuser');
			state.helpMoving = 0;
			state.helpObjects = 0;
			this.emitWithState('helpTheUser');	
		}
		else {
			console.error('to game');
			this.handler.state = GAME_STATES.GAME;
			this.emitWithState('moveToRoom');
		}
	},
	'AMAZON.CancelIntent' : function(){
		if (state.helpMoving + state.helpObjects > 0){
			state.helpMoving = 0;
			state.helpObjects = 0;
			this.emitWithState('helpTheUser');	
		}
		else {
			this.handler.state = GAME_STATES.GAME;
			this.emitWithState('moveToRoom');
		}
	},
	'AMAZON.StopIntent' : function(){
		this.handler.state = GAME_STATES.GAME;
        this.emitWithState('moveToRoom');
	},
	'returnToGame' : function(){
		this.handler.state = GAME_STATES.GAME;
		this.emitWithState('moveToRoom');
	},
	'Unhandled': function() {
		this.handler.state = GAME_STATES.GAME;
        this.emitWithState('moveToRoom');
    }
});

//POLYFILL FOR ARRAY.INCLUDES()
if (!Array.prototype.includes) {
  Array.prototype.includes = function(searchElement /*, fromIndex*/) {
    'use strict';
    if (this == null) {
      throw new TypeError('Array.prototype.includes called on null or undefined');
    }

    var O = Object(this);
    var len = parseInt(O.length, 10) || 0;
    if (len === 0) {
      return false;
    }
    var n = parseInt(arguments[1], 10) || 0;
    var k;
    if (n >= 0) {
      k = n;
    } else {
      k = len + n;
      if (k < 0) {k = 0;}
    }
    var currentElement;
    while (k < len) {
      currentElement = O[k];
      if (searchElement === currentElement ||
         (searchElement !== searchElement && currentElement !== currentElement)) { // NaN !== NaN
        return true;
      }
      k++;
    }
    return false;
  };
}