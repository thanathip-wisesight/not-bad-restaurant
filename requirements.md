# Not Bad Restaurant Order application

## Why?

I am still holding a grudge from bad experience with decent to good food, but otherwise has HORRIBLE web-app order system. 

So, today, I will design spec for the food ordering system, at least for a customer side.
If time permits, I'll also design spec for restaurant side, too.


*Note*

This spec is only for demo and POC.

This spec describes only the Customer Side of the service, with all the requirement about payment stubbed out. Italso describe "Stub" of Restaurant side requirement to update status of orders. The menu are already filled with the list of 60 items of common thai food with "main","a la carte", "soup","special", "dessert","Drink" categories. The Restaurant side interaction with the Customer side is only to update individual order status, confirm payment (through cashier manually), and clear "orders" from a table.


It's expected to have working database, a real usable web-app with complete flow for the customer side, and a simple management page for Restaurant Side that the restaurant can only show each table orders status, and clear the bill & orders from the customer side, but keep the bill history in database (for sure).

-----

# Customer Side






### Note to Coding Agent

order means a unit of food order.

a bunch of food orders is designated a bill. You can suggest the more appropriate term


## Brief description of the system

Traditionally, when we eat out at a restaurant, there will be a personel (server) who takes orders from us, either verbally or written in a piece of paper. Then, the server will pass the order to the kitchen manager and then the manager will arrange order of food to be cooked. After food is made, a server then takes the food and serve it to the customer. After the customer finishes all the food, they make payment for food.


This proposed application is supposed to make the described process of eating at a restaurant more convenient. It should keep track of the status of each order individually, to lessen the problem of missing or slow orders.

In a restaurant, each table or seat has a QR code that is specific to the table number. When a customer scan the QR code with their smart phone camera, they will be redirected to mobile browser that opens the application web app. In the app, a customer will see array of menu of the restaurant. It shows the table number, the status of orders, promotion, etc. The user navigate menu that is designed to resemble traditional menu as much as possible - it can either be 'flipped' page by page, or be a scroll-based navigation. When a user click on an item, options menu will pop up such as "extra", and MUST have note section - for human-parsable requirement such as "no beansprout!", then click/touch confirm/cancel. If it is confirmed, an order is created. When the customer add more item, the order is added with the new item. When the customer confirm the orders, and queued for the kitcen to cook. The customer is then given paper bill of the order with the list of all orders. After the food is made, the customer is served the food. When the customer is finished with it, they can either make payment with Thailand QR code payment, or they take the paper bill to the cashier and make payment there. Either way, the orders in that table number are cleared for next customers.




## Non functional requirement

It's expected to be an application hosted on Vercel. IT should be mobile-based. The "menu" has 2 modes - Modern or "traditonal-like". Modern mode is vertical with 2 columns that can scroll down to see more items, with also tabs for different categories of food such as "main course", "a la carte", "desserts", "drink". "Traditional-like" is horizontal, each page has 4 columns of 2 rows of food, grouped by category, if the food of category doesn't fill the page, just cut it off and the next page will begin the next category. The "traditional-like" mode also has category tab.


## Journey

### J1. A customer open menu

A customer scans a QR code at the table, they are the navigated to the mobile browser with the restaurant menu page opened.

### J2. A Customer order food.

A Customer navigate through web-app menu. When the customer see food they want, they click/touch on the "add" of the food menu, then they are directed to food options page which contain options for the food, and the customer can add note for the order. The customer then click confirm to add it and create a new pending bill. IF they click cancel, then everything in the options are discarded, and existing bill stay the same. If a new food order is created with an existing bill, the bill is modified to have the new order and with new total sum of payment.

### J3. A Customer confirm orders.

When the customer finish with ordering, they click "confirm" orders. Then the orders are added to queue. The Restaurant side then issue and print a paper bill and serve it to the customer

### J4. A customer check orders status, get served with food

A customer can check status of the orders with "orders" tab, which show all the orders made. Each item shows its status - "in progress" and "done". When an order is cooked and served, only then will it become "done". The Restaurant Side is the one to update the status.


### J5. A customer make payment.

A. A Customer can click/touch QR code payment, which will show options of payment through Thailand banking applications, the customer is redirected to the selected bank app, confirm payment there, and is redirected back to the "menu" page with message showing that the payment is successful
or
B. A customer can take the paper bill from J3 and take it to the cashier and make the payment there. The cashier will key the order number, check for the sum and wait for the payment. 

Either way, the orders and its bill is cleared from the "orders" tab of the Customer Side menu.














