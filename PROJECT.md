I looked at your use-case diagram. It seems to be a **P2P Vehicle Renting System** with three actors:

* **Admin**
* **Vehicle Owner**
* **Renter**

Main use cases visible in the diagram include:

* Manage Vehicles
* View Bookings
* View Earnings
* Reviews
* Register/Login
* Login
* Search Vehicles
* View Vehicle Details
* Book Vehicle
* Make Payment
* Verify Payment
* Update Booking
* Verify User
* Verify Vehicle
* Resolve Disputes

Below is a **structured `.md` file** you can give to **GitHub Copilot** so it can generate backend APIs step-by-step for your **Node.js + Express + MongoDB** project.

---

# P2P Vehicle Renting API Development Guide

## Tech Stack

* **Backend:** Node.js + Express
* **Database:** MongoDB
* **Auth:** JWT
* **Payments:** Khalti / eSewa
* **Architecture:** MVC (controllers, models, routes)

---

# 1. Project Setup

```
src/
 ├── config/
 │    └── db.js
 ├── models/
 ├── controllers/
 ├── routes/
 ├── middlewares/
 ├── utils/
 └── server.js
```

Install dependencies

```bash
npm init -y
npm install express mongoose jsonwebtoken bcryptjs dotenv cors
```

---

# 2. Database Models

## User Model

Roles:

* admin
* owner
* renter

Fields

```
name
email
password
phone
role
isVerified
createdAt
```

---

## Vehicle Model

```
ownerId
title
description
vehicleType
location
pricePerDay
images
availability
isVerified
createdAt
```

---

## Booking Model

```
vehicleId
renterId
ownerId
startDate
endDate
totalPrice
status
paymentStatus
createdAt
```

Statuses

```
pending
confirmed
cancelled
completed
```

---

## Review Model

```
vehicleId
renterId
rating
comment
createdAt
```

---

## Payment Model

```
bookingId
amount
paymentMethod
paymentStatus
transactionId
createdAt
```

---

# 3. Authentication APIs

## Register User

POST `/api/auth/register`

```
name
email
password
role (owner/renter)
```

Steps

1. Validate input
2. Hash password
3. Save user
4. Return JWT token


## Login

POST `/api/auth/login`

```
email
password
```

Steps

1. Find user
2. Compare password
3. Generate JWT
4. Return token

---

# 4. Vehicle Management (Owner)

## Add Vehicle

POST `/api/vehicles`

Owner adds a vehicle.

Fields

```
title
description
vehicleType
location
pricePerDay
images
```

---

## Update Vehicle

PUT `/api/vehicles/:id`

Owner updates vehicle details.

---

## Delete Vehicle

DELETE `/api/vehicles/:id`

Owner removes vehicle.

---

## View My Vehicles

GET `/api/vehicles/owner`

Returns vehicles added by owner.

---

# 5. Vehicle Discovery (Renter)

## Search Vehicles

GET `/api/vehicles/search`

Query parameters

```
location
vehicleType
priceMin
priceMax
date
```

---

## View Vehicle Details

GET `/api/vehicles/:id`

Returns

* vehicle info
* owner info
* reviews
* availability

---

# 6. Booking System

## Book Vehicle

POST `/api/bookings`

Fields

```
vehicleId
startDate
endDate
```

Steps

1. Check vehicle availability
2. Calculate total price
3. Create booking
4. Status = pending

---

## View My Bookings

GET `/api/bookings/renter`

Returns renter bookings.

---

## Owner View Bookings

GET `/api/bookings/owner`

Owner sees bookings for their vehicles.

---

## Update Booking

PUT `/api/bookings/:id`

Owner can

```
confirm booking
cancel booking
complete booking
```

---

# 7. Payment System

## Initiate Payment

POST `/api/payments/initiate`

Input

```
bookingId
paymentMethod
```

Steps

1. Fetch booking
2. Create payment record
3. Redirect to payment gateway

---

## Verify Payment

POST `/api/payments/verify`

Steps

1. Verify payment from gateway
2. Update paymentStatus
3. Update bookingStatus = confirmed

---

# 8. Reviews

## Add Review

POST `/api/reviews`

Fields

```
vehicleId
rating
comment
```

Only allowed after booking completion.

---

## Get Vehicle Reviews

GET `/api/reviews/:vehicleId`

---

# 9. Owner Dashboard

## View Earnings

GET `/api/owner/earnings`

Returns

```
totalRevenue
totalBookings
monthlyRevenue
```

---

## View Bookings

GET `/api/owner/bookings`

Shows bookings for owner's vehicles.

---

# 10. Admin APIs

Admin responsibilities:

* verify users
* verify vehicles
* resolve disputes
* platform monitoring

---

## Verify User

PUT `/api/admin/verify-user/:id`

Admin sets

```
isVerified = true
```

---

## Verify Vehicle

PUT `/api/admin/verify-vehicle/:id`

Admin approves vehicle listing.

---

## Resolve Disputes

POST `/api/admin/disputes`

Admin resolves booking/payment conflicts.

---

# 11. Security

Use middleware:

```
authMiddleware
roleMiddleware
```

Example

```
authMiddleware
roleMiddleware('owner')
```

---

# 12. Future Improvements

* Real-time booking updates
* Chat between renter and owner
* Vehicle availability calendar
* Map search
* Notifications
* Refund handling


