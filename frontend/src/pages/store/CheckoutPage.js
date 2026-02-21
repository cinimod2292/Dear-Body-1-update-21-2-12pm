import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, CreditCard, Building2, Smartphone, Lock, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Separator } from '../../components/ui/separator';
import { Card, CardContent } from '../../components/ui/card';
import { useStore } from '../../context/StoreContext';
import { toast } from 'sonner';
import { SHIPPING_RATES } from '../../data/mockData';

export default function CheckoutPage() {
  const { cart, cartTotal, placeOrder } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [shipping, setShipping] = useState(SHIPPING_RATES[0]);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [formData, setFormData] = useState({
    email: '', firstName: '', lastName: '', address: '', city: '', postcode: '', country: 'UK', phone: '',
    cardNumber: '', expiry: '', cvc: '', cardName: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const shippingCost = cartTotal >= (shipping.freeAbove || Infinity) ? 0 : shipping.price;
  const total = cartTotal + shippingCost;

  const handlePlaceOrder = () => {
    placeOrder({ total, shipping: shipping.name, payment: paymentMethod });
    toast.success('Order placed successfully!');
    navigate('/order-confirmation');
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="font-heading text-3xl mb-4">Your bag is empty</h1>
        <Button variant="beauty" asChild><Link to="/products">Continue Shopping</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="flex items-center gap-2 text-xs font-body text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors duration-200">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/cart" className="hover:text-foreground transition-colors duration-200">Cart</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Checkout</span>
      </nav>

      <h1 className="font-heading text-3xl sm:text-4xl mb-8">Checkout</h1>

      {/* Steps indicator */}
      <div className="flex items-center gap-4 mb-10">
        {['Shipping', 'Payment', 'Review'].map((label, i) => (
          <React.Fragment key={label}>
            <button
              onClick={() => i + 1 < step && setStep(i + 1)}
              className={`flex items-center gap-2 ${step > i + 1 ? 'cursor-pointer' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-body font-semibold transition-colors duration-200 ${
                step > i + 1 ? 'bg-success text-success-foreground' : step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>
                {step > i + 1 ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm font-body hidden sm:block ${step === i + 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
            </button>
            {i < 2 && <div className={`flex-1 h-px ${step > i + 1 ? 'bg-success' : 'bg-border'}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Form */}
        <div className="lg:col-span-2">
          {/* Step 1: Shipping */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h2 className="font-heading text-2xl">Shipping Information</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Email</Label><Input value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="you@email.com" className="rounded-sm font-body" /></div>
                <div><Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Phone</Label><Input value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+44 7700 900000" className="rounded-sm font-body" /></div>
                <div><Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">First Name</Label><Input value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} className="rounded-sm font-body" /></div>
                <div><Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Last Name</Label><Input value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} className="rounded-sm font-body" /></div>
                <div className="sm:col-span-2"><Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Address</Label><Input value={formData.address} onChange={(e) => handleChange('address', e.target.value)} placeholder="123 Rose Lane" className="rounded-sm font-body" /></div>
                <div><Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">City</Label><Input value={formData.city} onChange={(e) => handleChange('city', e.target.value)} className="rounded-sm font-body" /></div>
                <div><Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Postcode</Label><Input value={formData.postcode} onChange={(e) => handleChange('postcode', e.target.value)} className="rounded-sm font-body" /></div>
              </div>

              <Separator />

              <h3 className="font-heading text-xl">Shipping Method</h3>
              <RadioGroup value={shipping.id.toString()} onValueChange={(val) => setShipping(SHIPPING_RATES.find(r => r.id.toString() === val))}>
                <div className="space-y-3">
                  {SHIPPING_RATES.map(rate => (
                    <label key={rate.id} className="flex items-center gap-3 p-4 rounded-md border border-border hover:border-primary/30 cursor-pointer transition-colors duration-200">
                      <RadioGroupItem value={rate.id.toString()} />
                      <div className="flex-1">
                        <p className="font-body text-sm font-medium">{rate.name}</p>
                        <p className="text-xs font-body text-muted-foreground">{rate.description}</p>
                      </div>
                      <span className="font-body text-sm font-medium">
                        {cartTotal >= (rate.freeAbove || Infinity) ? <span className="text-success">Free</span> : `R${rate.price.toFixed(2)}`}
                      </span>
                    </label>
                  ))}
                </div>
              </RadioGroup>

              <Button variant="elegant" size="lg" className="w-full sm:w-auto rounded-sm" onClick={() => setStep(2)}>
                Continue to Payment <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h2 className="font-heading text-2xl">Payment Method</h2>

              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { value: 'card', label: 'Credit Card', icon: CreditCard },
                    { value: 'bank', label: 'Bank Transfer', icon: Building2 },
                    { value: 'mobile', label: 'Mobile Pay', icon: Smartphone },
                  ].map(opt => (
                    <label key={opt.value} className={`flex flex-col items-center gap-2 p-4 rounded-md border cursor-pointer transition-colors duration-200 ${paymentMethod === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                      <RadioGroupItem value={opt.value} className="sr-only" />
                      <opt.icon className="w-5 h-5" />
                      <span className="font-body text-xs font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </RadioGroup>

              {paymentMethod === 'card' && (
                <Card className="border-border">
                  <CardContent className="p-4 space-y-4">
                    <div><Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Card Number</Label><Input value={formData.cardNumber} onChange={(e) => handleChange('cardNumber', e.target.value)} placeholder="4242 4242 4242 4242" className="rounded-sm font-body" /></div>
                    <div><Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Cardholder Name</Label><Input value={formData.cardName} onChange={(e) => handleChange('cardName', e.target.value)} className="rounded-sm font-body" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Expiry</Label><Input value={formData.expiry} onChange={(e) => handleChange('expiry', e.target.value)} placeholder="MM/YY" className="rounded-sm font-body" /></div>
                      <div><Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">CVC</Label><Input value={formData.cvc} onChange={(e) => handleChange('cvc', e.target.value)} placeholder="123" className="rounded-sm font-body" /></div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {paymentMethod === 'bank' && (
                <Card className="border-border"><CardContent className="p-4"><p className="font-body text-sm text-muted-foreground">Bank transfer details will be provided after order confirmation. Please complete payment within 48 hours.</p></CardContent></Card>
              )}
              {paymentMethod === 'mobile' && (
                <Card className="border-border"><CardContent className="p-4"><p className="font-body text-sm text-muted-foreground">You will be redirected to complete payment via Apple Pay, Google Pay, or similar mobile payment service.</p></CardContent></Card>
              )}

              <div className="flex gap-3">
                <Button variant="outline" size="lg" className="rounded-sm" onClick={() => setStep(1)}>Back</Button>
                <Button variant="elegant" size="lg" className="rounded-sm" onClick={() => setStep(3)}>Review Order <ChevronRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h2 className="font-heading text-2xl">Review Order</h2>

              <div className="space-y-4">
                <Card className="border-border">
                  <CardContent className="p-4">
                    <h3 className="font-body text-xs uppercase tracking-wider text-muted-foreground mb-2">Shipping To</h3>
                    <p className="font-body text-sm">{formData.firstName || 'John'} {formData.lastName || 'Doe'}</p>
                    <p className="font-body text-sm text-muted-foreground">{formData.address || '123 Rose Lane'}, {formData.city || 'London'} {formData.postcode || 'SW1A 1AA'}</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">{shipping.name} • {shipping.description}</p>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-4">
                    <h3 className="font-body text-xs uppercase tracking-wider text-muted-foreground mb-2">Payment</h3>
                    <p className="font-body text-sm capitalize">{paymentMethod === 'card' ? `Credit Card ending in ${(formData.cardNumber || '4242').slice(-4)}` : paymentMethod === 'bank' ? 'Bank Transfer' : 'Mobile Payment'}</p>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-4">
                      <div className="w-14 h-16 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground font-body">Qty: {item.quantity}</p>
                      </div>
                      <span className="font-body text-sm font-medium">R{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" size="lg" className="rounded-sm" onClick={() => setStep(2)}>Back</Button>
                <Button variant="elegant" size="lg" className="flex-1 rounded-sm" onClick={handlePlaceOrder}>
                  <Lock className="w-4 h-4" /> Place Order — R{total.toFixed(2)}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-body text-center flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Your information is securely encrypted
              </p>
            </motion.div>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-lg border border-border p-6 sticky top-32">
            <h2 className="font-heading text-xl mb-4">Summary</h2>
            <div className="space-y-3 mb-4">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-12 h-14 rounded-md overflow-hidden bg-secondary flex-shrink-0 relative">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-foreground text-background text-[10px] font-body font-bold flex items-center justify-center">{item.quantity}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-xs truncate">{item.name}</p>
                  </div>
                  <span className="font-body text-xs">R{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="space-y-2 text-sm font-body">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>R{cartTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{shippingCost === 0 ? <span className="text-success">Free</span> : `R${shippingCost.toFixed(2)}`}</span></div>
              <Separator />
              <div className="flex justify-between font-medium"><span>Total</span><span className="font-heading text-lg">R{total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
