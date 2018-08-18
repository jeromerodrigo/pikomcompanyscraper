const axios = require('axios').default;
const axiosRetry = require('axios-retry');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

axiosRetry(axios, { retries: 3 });

const endpoint = "http://www.pikom.org.my";
const categoriesUrl = "http://www.pikom.org.my/cms/AllProductByCat-1.asp?CatID=53&type=";

const flatten = (arr) => {
    return arr.reduce(function (flat, toFlatten) {
        return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
};

const jsonToCsv = inputJson => {

    console.log(`Got input! ${inputJson.length}`);

    const Json2csvParser = require('json2csv').Parser;
    const json2csvParser = new Json2csvParser();
    const csv = json2csvParser.parse(inputJson);
    
    const fs = require('fs');

    fs.writeFileSync('./companies.csv', csv, { encoding: 'utf-8' });

    const endTime = new Date();

    const secondsElapsed = (endTime - startTime) / 1000;

    console.log(`Time taken: ${secondsElapsed}s`);
};

async function getCompany(companyUrl) {
    try {
        const response = await axios.get(`${endpoint}${companyUrl}`, { timeout: 300000 });
        return response;
    } catch (err) {
        console.log(err.code);
        return false;
    }
};

const parseCompany = (res, categoryName) => {

        const dom = new JSDOM(res.data);
        const { document } = dom.window;

        const companyElem = document.querySelector(".white > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > form:nth-child(1) > table:nth-child(2) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > b:nth-child(1)");
        const compIdElem = document.querySelector("span.grays:nth-child(2)");

        const companyDetailsElem = document.querySelector(".white > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > form:nth-child(1) > table:nth-child(2) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2)");

        const detailsStr = companyDetailsElem.textContent;

        // Telephone
        const idxStart = detailsStr.lastIndexOf("Tel") + 4;
        const idxEnd = detailsStr.lastIndexOf("Fax");
        const tel = detailsStr.substring(idxStart, idxEnd).trim();

        // Email
        const idxStartEmail = detailsStr.lastIndexOf("Email") + 6;
        const idxEndEmail = detailsStr.lastIndexOf("\n");

        const email = detailsStr.substring(idxStartEmail, idxEndEmail).trim();

        // Person
        const personElem = document.querySelector(".white > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > form:nth-child(1) > table:nth-child(4) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1)");
        const personStr = personElem.textContent;

        const person = personStr.substring(personStr.indexOf(":") + 1).trim();

        return {
            id: -1,
            companyName: `${companyElem.textContent} ${compIdElem.textContent}`,
            telephoneNo: tel,
            email,
            person,
            url: res.config.url,
            categoryName
        };
};

const scrapeCategory = (categoryUrl, categoryName) => {

    return axios.get(`${endpoint}${categoryUrl}`).then(res => {

        const dom = new JSDOM(res.data);
        const { document } = dom.window;

        const nodeList = document.querySelectorAll("a.orange");

        const companyUrls = [];

        nodeList.forEach(elem => {
            const url = elem.getAttribute("href");

            const company = {
                url,
                categoryName
            };

            console.log(JSON.stringify(company));

            companyUrls.push(company);
        });

        return companyUrls;
    }).catch(err => {
        console.log(`Cannot scrape category due to ${err.request.Error}`);
        return Promise.resolve();
    });
};

const startTime = new Date();

axios.get(categoriesUrl).then(res => {

    const dom = new JSDOM(res.data);
    const { document } = dom.window;

    const nodeList = document.querySelectorAll("a.orange");

    return nodeList;
})
.then(nodes => {

    const promises = [];
    
    nodes.forEach(elem => {
        const url = elem.getAttribute("href");
        const category = elem.textContent;
        promises.push(scrapeCategory(url, category));
    });

    return Promise.all(promises);
})
.then(async values => {
    const companyUrls = flatten(values);

    console.log(companyUrls.length);

    //const promises = companyUrls.map(url => scrapeCompany(url));

    let companies = [];

    for (let i = 0; i < companyUrls.length; i++) {
        const res = await getCompany(companyUrls[i].url);
        console.log(`Got company ${companyUrls[i].url}`);

        if (res) {
            companies.push(parseCompany(res, companyUrls[i].categoryName));
        }
    }

    return companies;
})
.then(companies => {

    console.log(companies.length);

    let idCount = 0;
    companies = companies.map(company => {
        idCount = idCount + 1;
        company.id = idCount;
        return company;
    });

    jsonToCsv(companies);
})
.catch(err => console.log(err));