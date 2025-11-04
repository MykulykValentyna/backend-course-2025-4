//підключаємо вбудовані модулі Node.js для роботи із файломи HTTP
const fs=require('fs');
const http=require('http');
//підключаємо сторонні бібліотеки
const{Command}=require('commander'); //обробка параметрів командного рядка
const{readFile, writeFile}=require('fs/promises'); //для асинхронного читання файлів
const {XMLBuilder}=require('fast-xml-parser'); //для ств. XML
//створюємо об'єкт для роботи з командами
const program=new Command();
program 
    .requiredOption('-i, --input <file>', 'input JSON file')
    .requiredOption('-h, --host <host>', 'server host')
    .requiredOption('-p, --port <port>', 'server port');
program.parse(process.argv);//аналізуємо параметри з командного рядка
const options = program.opts();//отримаємо значення параметрів у об'єкт
//перевіряємо чи існує вказаний файл
if (!fs.existsSync(options.input)) {
    console.error("Cannot find input file");
    process.exit(1);
}
//створюємо HTTP сервер, який оброблятиме запити
const server = http.createServer(async(req, res)=>{
    console.log("HTTP request:");
    console.log("Method:", req.method);
    console.log("URL:", req.url);
    console.log("Headers:", req.headers);
    try{
        const data=await readFile(options.input, 'utf-8');//асинхронне читання вмісту файлу
        //обробляємо дані з файлу
        const houses = data
            .split('\n')//розбиваємо текст на рядки
            .map(line=>line.trim())//Х зайві пробіли
            .filter(line=>line)//Х порожні рядки
            .map(line=>JSON.parse(line));//кожен рядок -> об'єкт
        //аналізуємо URL запит для отримання параметрів
        const url=new URL(req.url, `http://${options.host}:${options.port}`);
        //отримуємо параметр "furnished"
        const furnishedOnly=url.searchParams.get('furnished')==='true';
        //отримуємо параметр "max_price"
        const maxPrice=url.searchParams.get('max_price')
            ?parseFloat(url.searchParams.get('max_price'))//є параметр -> число
            :null;//нема - нуль
        //починаємо зі всіх будинків
        let filteredHouses=houses;
        //якщо тільки мебльовані
        if(furnishedOnly){ 
            filteredHouses=filteredHouses.filter(house=>house.furnishingstatus==="furnished"); 
        } else {
            filteredHouses=filteredHouses.filter(house=>house.furnishingstatus==="unfurnished");
        }
        // якщо furnishedOnly = false або null - не фільтруємо за статусом меблювання
        //якщо вказана максимальна ціна
        if (maxPrice){
            //лишаємо лиш ті будинки, у яких ціна менша за вказану
            filteredHouses=filteredHouses.filter(house=>parseFloat(house.price)<maxPrice);
        }
        //готуємо дані до перетворення в XML
        const xmlData={
            houses: {//основний тег
                house: filteredHouses.map(house=>{//для кожного будинку - тег
                    const obj={
                        price: house.price,
                        area: house.area,
                        furnishingstatus: house.furnishingstatus
                    };
                    return obj;
                })
            }
        };
        //створюємо XML білдер з налаштуваннями
        const builder = new XMLBuilder({
            ignoreAttributes: false,//не ігнорувати атрибути
            format: true//форматувати
        });
        //об'єкт -> XML рядок
        const xml = builder.build(xmlData);
        const outputFileName = 'filtered_houses.xml';
        //асинхронний запис
        await writeFile(outputFileName, xml, 'utf-8');
        console.log(`[INFO] XML result written to ${outputFileName}`);
        //інформація про відповідь
        console.log("===HTTP Response===");
        console.log("Status: 200 OK");
        console.log("Headers: {'Content-Type': 'application/xml'}");
        //установлюємо заголовки відповіді
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        //відправляємо XML як відповідь
         res.end(xml);
    } catch(err) {
        console.error(err);
        //відпрвляємо помилку клієнту
        res.writeHead(500, {'Content-Type': 'text/plain'});
        res.end('Server error');
    }
});
//запускаємо сервер на вказаних хості й порті
server.listen(options.port, options.host, () => {
    //повідомлення, що запущено
    console.log(`Server running at http://${options.host}:${options.port}/`);
});