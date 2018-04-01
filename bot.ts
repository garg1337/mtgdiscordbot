import * as Discord from 'discord.js';
import * as Scry from 'scryfall-sdk';
const Url = require('urijs');
const Config = require('./config.json');

// instantiate client
const client = new Discord.Client();


let str = '';
client.on('ready', () => {
    console.log('I am reddy');
});

client.on('message', msg => {
    let cards: string[] = getCards(msg.content);
    if(cards && cards.length !== 0) {
        let cardsPromise = getResponsesForCards(cards);
        cardsPromise
        .then(cardResponses => {
            cardResponses.forEach(cardResponse => {
                sendResponseFromCard(cardResponse, msg);
            })})
        .catch(error => {
            msg.channel.send('An error occurred ' + error);
        });
    };
});

function sendResponseFromCard(cardResponse: CardResponse, msg: Discord.Message): any {
    if (!cardResponse.card) {
        msg.channel.send('Error searching for card: ' + cardResponse.notFoundError);
        return;
    }

    if (!cardResponse.imgOnly) {
        msg.channel.sendEmbed({
            title: `${cardResponse.card.name} ${cardResponse.card.mana_cost}`,
            description: cardResponse.card.oracle_text ? cardResponse.card.oracle_text : '',
            url: cardResponse.card.scryfall_uri,
            thumbnail: {
                url: cardResponse.card.image_uris.normal ? cardResponse.card.image_uris.normal : ''
            }
        });
    }
    else {
        msg.channel.sendEmbed({
            title: `${cardResponse.card.name}`,
            url: cardResponse.card.scryfall_uri,
            image: {
                url: cardResponse.card.image_uris.normal ? cardResponse.card.image_uris.normal : ''
            }
        });
    }
}

client.login(Config.token);

function getResponsesForCards(cards: string[]): Promise<CardResponse[]> {
    let responses: Promise<CardResponse>[] = [];
    cards.forEach(card => {
        responses.push(new Promise((resolve,reject) => {
            let imgOnly = card.indexOf('!') === 0;
            let cardForSearch = imgOnly ? card.slice(1) : card;
            Scry.Cards.byName(cardForSearch)
            .then(response => {
                resolve({
                    imgOnly: imgOnly,
                    card: response
                });    
            })
            .catch(error => {
                resolve({
                    imgOnly: imgOnly,
                    notFoundError: error
                });
            })
        }));
    });

    return Promise.all(responses);
}

interface CardResponse {
    imgOnly: boolean,
    card?: Scry.Card,
    notFoundError?: string
}

function getCards(str: string): string[] {
    // card regex
    const regex = /\[\[([^\[\]]*)\]\]/g;
    let m;
    let cards: string[] = [];
    while ((m = regex.exec(str)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        
        // The result can be accessed through the `m`-variable.
        m.forEach((match, groupIndex) => {
            if (groupIndex == 1)
            {
                cards.push(match);
            }
        });
    }        
    return cards;
}