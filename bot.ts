import * as Discord from 'discord.js';
import * as Scry from 'scryfall-sdk';
const Url = require('urijs');
const Config = require('./config.json');
const manamoji = require('./manamoji');

// instantiate client
const client = new Discord.Client();

let str = '';
client.on('ready', () => {
    console.log('I am reddy');
});

client.on('error', error => {
    console.log(error);
})

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

    let embeds: Discord.RichEmbedOptions[] = [];
    switch (cardResponse.responseType) {
        case ResponseType.Full: {
            let card = cardResponse.results[0];
            embeds = buildRegularCardEmbed(card);
            break;
        };
        case ResponseType.ImageOnly: {
            let card = cardResponse.results[0];
            embeds = buildImageCardEmbed(card);
            break;    
        }
        case ResponseType.Multiple: {
            let results = cardResponse.results;
            if (cardResponse.results.length > 10) {
                results = results.slice(0, 10);   
            }
            let fields = results.map(result => ({
                name: result.name,
                value: result.scryfall_uri
            }));

            embeds = [{
                title: `Multiple results found!${cardResponse.results.length > 10 ? ' Showing top 10 searches.' : ''}`,
                fields: fields
            }];
            break;
        }
    }

    embeds = embeds.map(embed => manamoji(msg.client, embed));
    embeds.forEach(embed => {
        msg.channel.sendEmbed(embed);
    });
}

function buildRegularCardEmbed(card: Scry.Card) {
    let results: Discord.RichEmbedOptions[] = [];
    if (card.card_faces) {
        card.card_faces.forEach(face => {
            let result = {
                title: `${face.name} ${face.mana_cost}`,
                description: buildCardFaceDescription(face),
                url: card.scryfall_uri,
                thumbnail: {
                    url: face.image_uris 
                    ? face.image_uris.normal
                    : (card.image_uris ? card.image_uris.normal : '') 
                },
                color: 8679679
            };
            results.push(result);
        });
    } else {
        let result = {
            title: `${card.name} ${card.mana_cost}`,
            description: buildCardDescription(card),
            url: card.scryfall_uri,
            thumbnail: {
                url: card.image_uris.normal ? card.image_uris.normal : ''
            },
            color: 8679679
        };
        results.push(result);    
    }
    return results;
}

function buildImageCardEmbed(card: Scry.Card) {
    let results: Discord.RichEmbedOptions[] = [];
    if (card.card_faces && !card.image_uris) {
        card.card_faces.forEach(face => {
            let result = {
                title: `${face.name}`,
                url: card.scryfall_uri,
                image: {
                    url: face.image_uris 
                    ? face.image_uris.normal
                    : (card.image_uris ? card.image_uris.normal : '') 
                },
                color: 8679679
            };
            results.push(result);
        });
    } else {
        let result = {
            title: `${card.name}`,
            url: card.scryfall_uri,
            image: {
                url: card.image_uris.normal ? card.image_uris.normal : ''
            },
            color: 8679679
        }
        results.push(result);    
    }
    return results;
}

function buildCardDescription(card: Scry.Card) {
    let description = '';
    if (card.type_line) {
        description += `${card.type_line}\n`;
    }

    if (card.oracle_text)
    {
        description += `${card.oracle_text}\n`;
    }

    if (card.power && card.toughness) {
        description += `${card.power}/${card.toughness}\n`
    }

    if (card.loyalty) {
        description += `Loyalty: ${card.loyalty}`
    }

    return description;
}

function buildCardFaceDescription(cardFace: Scry.CardFace) {
    let description = '';
    if (cardFace.type_line) {
        description += `${cardFace.type_line}\n`;
    }

    if (cardFace.oracle_text)
    {
        description += `${cardFace.oracle_text}\n`;
    }

    if (cardFace.power && cardFace.toughness) {
        description += `${cardFace.power}/${cardFace.toughness}\n`
    }

    if (cardFace.loyalty) {
        description += `Loyalty: ${cardFace.loyalty}`
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