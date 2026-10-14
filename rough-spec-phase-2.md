# Not Bad Restaurant requirements phase 2

## Description

This requirement describes additional specifications of console part of the Not Bad Restaurant system.


---

# Overall changes 

## Restaurant Branch

Now, a QR code (and hence http path scheme) at each table is tied to branch code AND table number.

The change thus requires existing specs and implementation to add branch code into bill history, cart, order, etc.

# Restaurant Side

The restaurant side console now requires basic authentication, which will log in a "user" who can belong to multiple branches of the restaurant brand. If the user belongs to only one branch, they are immediately directed to console page of that branch, otherwise, they must choose a branch from many they belong to.

Other than that, nothing really changes.

