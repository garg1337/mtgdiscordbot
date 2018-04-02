import * as Discord from 'discord.js';
import * as Scry from 'scryfall-sdk';
import "isomorphic-fetch";
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
    if (!cardResponse.results || !cardResponse.results[0]) {
        msg.channel.send(cardResponse.notFoundError);
        return;
    }

    let embeds: Promise<Discord.RichEmbedOptions[]> = Promise.resolve([]);
    switch (cardResponse.responseType) {
        case ResponseType.Full: {
            let card = cardResponse.results[0];
            embeds = Promise.resolve(buildRegularCardEmbed(card));
            break;
        };
        case ResponseType.ImageOnly: {
            let card = cardResponse.results[0];
            embeds = Promise.resolve(buildImageCardEmbed(card));
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

            embeds = Promise.resolve([{
                title: `Multiple results found!${cardResponse.results.length > 10 ? ' Showing top 10 searches.' : ''}`,
                fields: fields
            }]);
            break;
        }
        case ResponseType.Price: {
            let card = cardResponse.results[0];
            embeds = fetch(cardResponse.results[0].prints_search_uri)
            .then(response => {
                return response.json();
            })
            .then(json => {
                let printings: Scry.Card[] = json.data;
                return Promise.resolve(printings);
            })
            .then(printings => {
                let fields = printings.map((printing, index) => ({
                    name: printing.set_name,
                    value: buildPriceLine(printing),
                    inline: true
                }));
                let embed: any = {
                    title: `Prices for ${card.name}`,
                    url: card.scryfall_uri,
                    fields: fields
                };
                return Promise.resolve([embed]);
            })
        }
    }

    embeds.then(response => {
        let embedResps = response.map(embed => manamoji(msg.client, embed));
        embedResps.forEach(embedResp => {
            msg.channel.sendEmbed(embedResp);
        });
    });
}

function buildPriceLine(card: Scry.Card): string {
    let line = '';
    if (card.usd) {
        line += `$${card.usd}`;
    }

    if (card.eur) {
        line += ` • €${card.eur}`;
    }

    if (card.tix) {
        line += ` • ${card.tix} TIX`;
    }

    if (line.indexOf(' • ') === 0) {
        line = line.slice(3);
    }

    if (!line) {
        line = 'N/A'
    }

    return line;
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
        description += `${card.type_line}\n\n`;
    }

    if (card.oracle_text)
    {
        description += `${card.oracle_text}\n\n`;
    }

    if (card.power && card.toughness) {
        let power = card.power;
        let toughness = card.toughness;

        if (power.indexOf('*') !== -1) {
            power = power.replace('*', '\\*');
        }

        if (toughness.indexOf('*') !== -1) {
            toughness = toughness.replace('*', '\\*');
        }

        description += `${power}/${toughness}\n\n`
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
            let price = card.indexOf('$') === 0;
            respType = price ? ResponseType.Price : respType;
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