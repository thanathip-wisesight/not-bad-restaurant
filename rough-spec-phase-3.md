# Not Bad Restaurant requirements phase 3

## Description

This requirement mainly deals with more edge cases and more obscure error flow

---

# Overall changes 

## Host on Vercel

This can now be hosted on free-tier Vercel

------


## Customer Side

### J1. System keeps History 

Whenever the whole bill orders is completed and the order is "cleared", the orders are moved to *finished* status in database with each order status kept(finished, canceled, specia). This journey is only for data and telemetry purpose. 


**amended** History should keep all status change and log time, too. Such as pending at 2026-10-10 12:00:00, in-progress at 2026-10-10 12:01:00, served at 2026-10-10 12:07:00.



The history of orders can be searched and processed by item key, branch code for telemetry purpose, such as finding a popular menu, most problematic menu.


d


-------

## Restaurant Console side
(the number of journal)

### J1. Staff confirm to void pending order.

When a customer requests to cancel a pending order, a personel can choose to confirm voiding it. If the order is voided, it's moved to another status "canceled" for *telemetry* purpose.


### J2. Staff can void a pending or in-progress order without prompt

This usecase is an extreme one, which can really happen.


A personel can actually confirm to void a pending order without request from a customer, or an in-progress order. Both cases should prompt the personel to add note about the reason to void it. The voided order in this case is moved to status similar to "canceled", but disticted.

### J3. Staff can batch update status of many orders at once.

A personal can select multiple orders to be updated in batch, such as updating Fried Rice and Crispy Pork to in-progress att he same time. Both item orders should be updated with the same time log. This also include this new J2. journy


#### global remark

the 2 new statuses added by the Restaurant Console side journeys are visible only to Restaurant Console side. The 2 new statuses are kept in history of Customer Side J1


