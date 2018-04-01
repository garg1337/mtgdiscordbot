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

function sendResponseFromCard(cardResponse: CardResponse, msg: Discord.Message) {
    if (!cardResponse.results) {
        msg.channel.send(cardResponse.notFoundError);
        return;
    }

    switch (cardResponse.responseType) {
        case ResponseType.Full: {
            let card = cardResponse.results[0];
            console.log(card.all_parts);
            msg.channel.sendEmbed({
                title: `${card.name} ${card.mana_cost}`,
                description: buildCardDescription(card),
                url: card.scryfall_uri,
                thumbnail: {
                    url: card.image_uris.normal ? card.image_uris.normal : ''
                },
                color: 8679679
            });
            break;    
        };
        case ResponseType.ImageOnly: {
            let card = cardResponse.results[0];
            msg.channel.sendEmbed({
                title: `${card.name}`,
                url: card.scryfall_uri,
                image: {
                    url: card.image_uris.normal ? card.image_uris.normal : ''
                },
                color: 8679679
            });
            break;    
        }
        case ResponseType.Multiple: {
            let fields = cardResponse.results.map(result => ({
                name: result.name,
                value: result.scryfall_uri
            }));

            msg.channel.sendEmbed({
                title: `Multiple results found!`,
                fields: fields
            });
            break;
        }
    }
}

function buildCardDescription(card: Scry.Card) {
    let description = '';
    if (card.type_line) {
        description += `${card.type_line}\n`;
    }

    description += `${card.oracle_text}\n`;

    if (card.power && card.toughness) {
        description += `${card.power}/${card.toughness}\n`
    }

    if (card.loyalty) {
        description += `Loyalty: ${card.loyalty}`
    }

    return description;
}

client.login(Config.token);

function getResponsesForCards(cards: string[]): Promise<CardResponse[]> {
    let responses: Promise<CardResponse>[] = [];
    cards.forEach(card => {
        responses.push(new Promise((resolve,reject) => {
            let imgOnly = card.indexOf('!') === 0;
            let respType = imgOnly ? ResponseType.ImageOnly : ResponseType.Full
            let cardForSearch = imgOnly ? card.slice(1) : card;
            Scry.Cards.search(cardForSearch)
            .on("error", (error:Error) => {
                resolve({
                    responseType: respType,
                    notFoundError: 'No cards found =('
                });
            })
            .waitForAll()
            .then(response => {
                if (response.length > 1) {
                    let exactMatch = response.find(card => card.name.toLowerCase() === cardForSearch.toLowerCase());
                    if (exactMatch) {
                        resolve({
                            responseType: respType,
                            results: [exactMatch]                                
                        });
                    }
                    else {
                        resolve({
                            responseType: ResponseType.Multiple,
                            results: response
                        });    
                    }
                } else {
                    resolve({
                        responseType: respType,
                        results: response
                    });        
                }
            }) 
        }));
    });

    return Promise.all(responses);
}

interface CardResponse {
    responseType: ResponseType,
    notFoundError?: string
    results?: Scry.Card[]
}

enum ResponseType {
    Full,
    ImageOnly,
    Price,
    Multiple
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