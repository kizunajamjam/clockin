import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY!
export const PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL!
