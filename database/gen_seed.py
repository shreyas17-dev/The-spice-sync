"""
Generates 07_seed.sql (MySQL) and ../redis/02_seed.redis with realistic, rule-consistent data.
All timestamps are relative to the moment the script is loaded:
  @today = CURDATE()  (history: the last 60 days, real meal-time patterns)
  @now   = NOW()      (a handful of live orders that are still in progress)
so the dashboards always show "recent" data whenever the database is created.
Run:  python3 gen_seed.py
"""
import hashlib, json, math, os, random, re
from collections import defaultdict
from seed_catalog import *

random.seed(2026)
OUT_SQL = os.path.join(os.path.dirname(__file__), "07_seed.sql")
OUT_REDIS = os.path.join(os.path.dirname(__file__), "..", "redis", "02_seed.redis")
DEMO_PASSWORD = "Password@123"
GST, FREE_ABOVE = 0.05, 499

def pw_hash(pw):
    salt = os.urandom(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=16384, r=8, p=1, dklen=64)
    return f"scrypt${salt.hex()}${h.hex()}"

def km(a_lat, a_lon, b_lat, b_lon):
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lon - a_lon)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(6371 * 2 * math.asin(math.sqrt(a)), 2)

def r2(x): return round(x + 1e-9, 2)
def q(v):
    if v is None: return "NULL"
    if isinstance(v, bool): return "TRUE" if v else "FALSE"
    if isinstance(v, int): return str(v)
    if isinstance(v, float):
        t = f"{v:.6f}".rstrip("0").rstrip(".")
        return t if t not in ("", "-0") else "0"
    if isinstance(v, Raw): return v.s
    return "'" + str(v).replace("\\", "\\\\").replace("'", "''") + "'"
class Raw:
    def __init__(self, s): self.s = s
def T(sec):          # history timestamp: seconds relative to today 00:00
    sec = int(sec)
    return Raw(f"@today + INTERVAL {sec} SECOND") if sec >= 0 else Raw(f"@today - INTERVAL {-sec} SECOND")
def N(sec):          # live timestamp: seconds relative to now (negative = in the past)
    return Raw(f"@now - INTERVAL {-int(sec)} SECOND")
def ll(v): return float(f"{v:.6f}")
def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
def email_of(name, n=None):
    base = ".".join(re.sub(r"[^a-z ]", "", name.lower()).split())
    return f"{base}{n or ''}@example.com"

used_phones = set()
def phone(first_digits="9876"):
    while True:
        p = random.choice("6789") + "".join(random.choice("0123456789") for _ in range(9))
        if p not in used_phones:
            used_phones.add(p); return p

DAY = 86400
def hhmm(s): h, m = map(int, s.split(":")); return h * 3600 + m * 60
def is_open(op, cl, tod):
    o, c = hhmm(op), hhmm(cl)
    return o <= tod <= c if o <= c else (tod >= o or tod <= c)

rows = defaultdict(list)
pin = {p[0]: p for p in PINCODES}
for p in PINCODES:
    rows["pincode"].append((p[0], p[2], p[3]))

# ---------------- admins
for i, (name, email, level, days) in enumerate(ADMINS, 1):
    rows["admin"].append((i, name, email, pw_hash(DEMO_PASSWORD), level, T(-days * DAY + 36000)))

# ---------------- owners
for i, (name, pan, acct) in enumerate(OWNERS, 1):
    rows["restaurant_owner"].append((i, name, email_of(name), phone(), pw_hash(DEMO_PASSWORD), pan, acct, "ACTIVE"))

# ---------------- restaurants, cuisines, menus
REST = {}
STD = {"Bengaluru": "080", "Mumbai": "022", "Hyderabad": "040"}
menu_id = 0
MENU = defaultdict(list)   # rid -> list of dict
for rid, (name, owner, pc, cuisines, op, cl, prep, cost, comm, status) in enumerate(RESTAURANTS, 1):
    p = pin[pc]
    lat, lon = p[4] + random.uniform(-0.004, 0.004), p[5] + random.uniform(-0.004, 0.004)
    street = random.choice(STREETS[p[1]])
    addr = f"{random.randint(2, 180)}, {street}, {p[1]}"
    approved_by = random.choice([1, 2]) if status != "PENDING" else None
    approved_at = T(-random.randint(120, 400) * DAY + random.randint(36000, 64000)) if approved_by else None
    REST[rid] = dict(id=rid, name=name, owner=owner, pc=pc, city=p[2], lat=ll(lat), lon=ll(lon), op=op, cl=cl,
                     prep=prep, comm=comm, status=status, quality=random.uniform(3.7, 4.6))
    rows["restaurant"].append((rid, owner, name, STD[p[2]] + str(random.randint(40000000, 49999999)), addr, pc,
                               ll(lat), ll(lon), op + ":00", cl + ":00", prep, float(cost), float(comm), status, approved_by, approved_at))
    for c in cuisines:
        rows["restaurant_cuisine"].append((rid, c))
    for (iname, cat, price, veg, desc) in MENUS[name]:
        menu_id += 1
        MENU[rid].append(dict(id=menu_id, name=iname, price=price, veg=veg))
        rows["menu_item"].append([menu_id, rid, iname, desc, cat, float(price), bool(veg), True, f"/images/menu/{slug(iname)}.jpg"])
# a few items currently sold out
for idx in random.sample(range(len(rows["menu_item"])), 7):
    rows["menu_item"][idx][7] = False
old_price = {}
for (rname, iname, old, days) in PRICE_CHANGES:
    rid = [r for r in REST.values() if r["name"] == rname][0]["id"]
    it = [m for m in MENU[rid] if m["name"] == iname][0]
    old_price[it["id"]] = (old, -days * DAY)

# ---------------- customers + addresses (weak entity)
CITY_OF = []
for i in range(len(CUSTOMERS)):
    CITY_OF.append("Bengaluru" if i < 25 else "Mumbai" if i < 43 else "Hyderabad")
CUST, ADDR = {}, defaultdict(list)
for cid, name in enumerate(CUSTOMERS, 1):
    city = CITY_OF[cid - 1]
    created = -random.randint(65, 650) * DAY + random.randint(30000, 80000)
    status = "BLOCKED" if cid in (19, 47) else "ACTIVE"
    dob = f"{random.randint(1978, 2005)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
    CUST[cid] = dict(id=cid, city=city, status=status, pts=0)
    rows["customer"].append((cid, name, email_of(name), phone(), pw_hash(DEMO_PASSWORD), dob, 0, status, T(created)))
    city_pins = [p for p in PINCODES if p[2] == city and any(r["pc"] == p[0] for r in REST.values())]
    n_addr = random.choices([1, 2, 3], [60, 30, 10])[0]
    labels = ["Home", "Work", "Other"]
    chosen = random.sample(city_pins, min(n_addr, len(city_pins)))
    for no, p in enumerate(chosen, 1):
        lat, lon = p[4] + random.uniform(-0.008, 0.008), p[5] + random.uniform(-0.008, 0.008)
        flat = random.choice(["Flat", "House No.", "#"]) + f" {random.randint(1, 40)}{random.choice(['', 'A', 'B'])}"
        line = f"{flat}, {random.choice(STREETS[p[1]])}, {p[1]}"
        ADDR[cid].append(dict(no=no, lat=ll(lat), lon=ll(lon), pc=p[0]))
        rows["address"].append((cid, no, labels[no - 1], line, p[0], ll(lat), ll(lon), no == 1))

# ---------------- delivery partners
PART, pid = {}, 0
status_plan = {"Bengaluru": ["ACTIVE"] * 7 + ["PENDING"], "Mumbai": ["ACTIVE"] * 7 + ["BLOCKED"],
               "Hyderabad": ["ACTIVE"] * 6 + ["PENDING"] * 2}
for city, names in PARTNERS.items():
    for k, name in enumerate(names):
        pid += 1
        st = status_plan[city][k]
        vtype = "BICYCLE" if k == 3 else random.choice(["MOTORBIKE", "MOTORBIKE", "SCOOTER"])
        code = STATE_CODE[city]
        vno = None if vtype == "BICYCLE" else f"{code}{random.randint(1, 50):02d}{random.choice('ABCDEFGHJK')}{random.choice('ABCDEFGHJK')}{random.randint(1000, 9999)}"
        lic = None if vtype == "BICYCLE" else f"{code}{random.randint(1, 50):02d}{random.randint(2012, 2023)}{random.randint(1000000, 9999999)}"
        vby = random.choice([2, 3]) if st != "PENDING" else None
        vat = -random.randint(62, 300) * DAY + random.randint(36000, 60000) if vby else None
        PART[pid] = dict(id=pid, city=city, status=st, name=name, vby=vby, vat=vat, busy_until=-10**9,
                         quality=random.uniform(3.9, 4.9), blocked_from=-10 * DAY if st == "BLOCKED" else None)
        PART[pid]["row"] = [pid, name, email_of(name, pid), phone(), pw_hash(DEMO_PASSWORD), vtype, vno, lic,
                            "OFFLINE", None, None, st, vby, T(vat) if vat else None]

# ---------------- coupons (windows relative to today)
COUPONS = [
    # code, desc, type, value, max, min, from_days, to_days, limit, status, restaurant name
    ("WELCOME50", "Flat Rs 50 off on any order above Rs 199", "FLAT", 50, None, 199, -300, 120, 5000, "ACTIVE", None),
    ("SAVE20", "20% off up to Rs 100 above Rs 299", "PERCENT", 20, 100, 299, -200, 90, 3000, "ACTIVE", None),
    ("FEAST100", "Rs 100 off on orders above Rs 699", "FLAT", 100, None, 699, -45, 60, 1000, "ACTIVE", None),
    ("BIRYANI15", "15% off up to Rs 75 at Biryani Bhavan", "PERCENT", 15, 75, 300, -100, 60, 500, "ACTIVE", "Biryani Bhavan"),
    ("PIZZA99", "Rs 99 off on pizzas above Rs 549", "FLAT", 99, None, 549, -90, 45, 400, "ACTIVE", "Pizza Piazza"),
    ("DOSA10", "10% off up to Rs 40 on tiffins", "PERCENT", 10, 40, 150, -150, 90, 1000, "ACTIVE", "Nandi Udupi Tiffins"),
    ("NAWAB20", "20% off up to Rs 120 on biryani", "PERCENT", 20, 120, 400, -60, 30, 300, "ACTIVE", "Nawab's Dum Biryani"),
    ("SUSHI200", "Rs 200 off on orders above Rs 1499", "FLAT", 200, None, 1499, -30, 30, 50, "ACTIVE", "Sora Sushi Bar"),
    ("DIWALI25", "Festive 25% off up to Rs 150", "PERCENT", 25, 150, 399, -24, -3, 2000, "ACTIVE", None),
    ("MONSOON30", "Monsoon special 30% off up to Rs 90", "PERCENT", 30, 90, 249, -130, -70, 1500, "INACTIVE", None),
]
CPN = []
for i, c in enumerate(COUPONS, 1):
    rid = [r["id"] for r in REST.values() if r["name"] == c[10]][0] if c[10] else None
    CPN.append(dict(id=i, code=c[0], type=c[2], value=c[3], max=c[4], min=c[5], frm=c[6] * DAY, to=c[7] * DAY + 86399,
                    limit=c[8], status=c[9], rid=rid, used=0))
    rows["coupon"].append((i, c[0], c[1], c[2], float(c[3]), float(c[4]) if c[4] else None, float(c[5]),
                           T(c[6] * DAY), T(c[7] * DAY + 86399), c[8], c[9], rid))

# ---------------- historical orders (last 60 days, yesterday backwards)
HOUR_W = {7: 2, 8: 5, 9: 6, 10: 4, 11: 5, 12: 12, 13: 15, 14: 10, 15: 5, 16: 4, 17: 5, 18: 7,
          19: 11, 20: 15, 21: 13, 22: 8, 23: 3}
weights = [1 / (i ** 0.45) for i in range(1, len(CUSTOMERS) + 1)]
random.shuffle(weights)
order_id, orders = 0, []
METHODS = (["UPI", "CARD", "WALLET", "NETBANKING", "COD"], [45, 20, 10, 5, 20])

def bill(rid, items, a, when, coupon_try=True):
    r = REST[rid]
    sub = r2(sum(q_ * p for (_, q_, p) in items))
    dist = km(r["lat"], r["lon"], a["lat"], a["lon"])
    disc, cp = 0.0, None
    if coupon_try:
        cands = [c for c in CPN if c["status"] == "ACTIVE" and c["frm"] <= when <= c["to"] and sub >= c["min"]
                 and (c["rid"] is None or c["rid"] == rid) and c["used"] < c["limit"]]
        if cands:
            cp = random.choice(cands)
            disc = min(r2(sub * cp["value"] / 100), cp["max"] or sub) if cp["type"] == "PERCENT" else min(cp["value"], sub)
            disc = r2(disc)
    tax = r2((sub - disc) * GST)
    fee = 0.0 if sub >= FREE_ABOVE else r2(25 + 5 * max(dist - 2, 0))
    comm = r2(sub * r["comm"] / 100)
    return sub, disc, tax, fee, comm, cp, dist

def pick_items(rid, when):
    k = random.choices([1, 2, 3, 4], [35, 35, 20, 10])[0]
    chosen = random.sample(MENU[rid], min(k, len(MENU[rid])))
    out = []
    for m in chosen:
        price = m["price"]
        if m["id"] in old_price and when < old_price[m["id"]][1]:
            price = old_price[m["id"]][0]
        out.append((m["id"], random.choices([1, 2, 3], [75, 20, 5])[0], float(price)))
    return out

for day in range(60, 0, -1):
    n = random.randint(9, 15) + (3 if day % 7 in (0, 6) else 0)
    for _ in range(n):
        for attempt in range(40):
            cid = random.choices(range(1, len(CUSTOMERS) + 1), weights)[0]
            a = ADDR[cid][0] if random.random() < 0.8 or len(ADDR[cid]) == 1 else random.choice(ADDR[cid])
            hr = random.choices(list(HOUR_W), list(HOUR_W.values()))[0]
            tod = hr * 3600 + random.randint(0, 3599)
            when = -day * DAY + tod
            el = [r for r in REST.values() if r["city"] == CUST[cid]["city"] and is_open(r["op"], r["cl"], tod)
                  and (r["status"] == "ACTIVE" or (r["status"] == "SUSPENDED" and day > 12))
                  and km(r["lat"], r["lon"], a["lat"], a["lon"]) <= 8]
            if el:
                break
        else:
            continue
        r = random.choices(el, [r["quality"] ** 3 for r in el])[0]
        items = pick_items(r["id"], when)
        sub, disc, tax, fee, comm, cp, dist = bill(r["id"], items, a, when, coupon_try=random.random() < 0.24)
        if cp: cp["used"] += 1
        order_id += 1
        cancelled = random.random() < 0.07
        orders.append(dict(id=order_id, cid=cid, a=a, rid=r["id"], items=items, sub=sub, disc=disc, tax=tax, fee=fee,
                           comm=comm, cp=cp, dist=dist, when=when, status="CANCELLED" if cancelled else "DELIVERED", live=False))

# ---------------- live orders (relative to NOW)
LIVE_PLAN = [("PLACED", 2), ("PLACED", 4), ("PLACED", 7), ("CONFIRMED", 9), ("CONFIRMED", 12), ("PREPARING", 15),
             ("PREPARING", 18), ("READY", 24), ("PICKED_UP", 31), ("PICKED_UP", 38)]
live_customers = random.sample([c for c in CUST if CUST[c]["status"] == "ACTIVE"], len(LIVE_PLAN))
for (st, mins), cid in zip(LIVE_PLAN, live_customers):
    a = ADDR[cid][0]
    el = [r for r in REST.values() if r["city"] == CUST[cid]["city"] and r["status"] == "ACTIVE"
          and km(r["lat"], r["lon"], a["lat"], a["lon"]) <= 8]
    r = random.choice(el)
    items = pick_items(r["id"], 0)
    sub, disc, tax, fee, comm, cp, dist = bill(r["id"], items, a, 0, coupon_try=random.random() < 0.3)
    if cp: cp["used"] += 1
    order_id += 1
    orders.append(dict(id=order_id, cid=cid, a=a, rid=r["id"], items=items, sub=sub, disc=disc, tax=tax, fee=fee,
                       comm=comm, cp=cp, dist=dist, when=-mins * 60, status=st, live=True))

# ---------------- payments, deliveries, reviews
pay_id = del_id = rev_id = 0
live_partners = {}
for o in orders:
    total = r2(o["sub"] - o["disc"] + o["tax"] + o["fee"])
    o["total"] = total
    method = random.choices(*METHODS)[0]
    TS = N if o["live"] else T
    pay_id += 1
    txn = None if method == "COD" else f"TXN{o['id']:08d}{hashlib.md5(str(o['id']).encode()).hexdigest()[:6].upper()}"
    if o["status"] == "CANCELLED":
        pst, paid = ("FAILED", None) if method == "COD" else ("REFUNDED", TS(o["when"] + 25))
    elif o["status"] == "DELIVERED":
        pst = "SUCCESS"
        paid = None  # filled after delivery time is known for COD
    else:
        pst, paid = ("PENDING", None) if method == "COD" else ("SUCCESS", TS(o["when"] + 20))
    o["pay"] = [pay_id, o["id"], method, total, pst, txn, paid]

    needs_delivery = o["status"] in ("CONFIRMED", "PREPARING", "READY", "PICKED_UP", "DELIVERED")
    if not needs_delivery:
        continue
    r = REST[o["rid"]]
    assigned = o["when"] + random.randint(60, 240)
    if o["live"]:
        cands = [p for p in PART.values() if p["city"] == r["city"] and p["status"] == "ACTIVE" and p["id"] not in live_partners.values()]
        p = random.choice(cands)
        live_partners[o["id"]] = p["id"]
        picked = None
        if o["status"] == "PICKED_UP":
            picked = min(assigned + r["prep"] * 60 + random.randint(-120, 120), -4 * 60)
        delivered = None
        dst = "PICKED_UP" if o["status"] == "PICKED_UP" else "ASSIGNED"
    else:
        cands = [p for p in PART.values() if p["city"] == r["city"] and p["vby"] and p["vat"] < assigned
                 and (p["blocked_from"] is None or assigned < p["blocked_from"])]
        free = [p for p in cands if p["busy_until"] <= assigned]
        p = random.choice(free) if free else min(cands, key=lambda x: x["busy_until"])
        if p["busy_until"] > assigned:
            assigned = p["busy_until"] + 60
        picked = assigned + max(r["prep"] * 60 + random.randint(-240, 360), 240)
        delivered = picked + (math.ceil(o["dist"] * 4) + random.randint(2, 9)) * 60
        p["busy_until"] = delivered
        dst = "DELIVERED"
        if o["pay"][2] == "COD":
            o["pay"][6] = T(delivered)
        else:
            o["pay"][6] = T(o["when"] + 20)
        CUST[o["cid"]]["pts"] += int(math.floor(total / 100))
    del_id += 1
    earn = r2(20 + 7 * o["dist"])
    o["delivery"] = dict(id=del_id, pid=p["id"], status=dst, assigned=assigned, picked=picked, delivered=delivered, earn=earn)
    if dst == "DELIVERED" and random.random() < 0.62:
        rev_id += 1
        created = delivered + random.randint(600, 10800)
        if created > -1800:
            created = delivered + 300
        fq = max(1, min(5, round(random.gauss(REST[o["rid"]]["quality"], 0.7))))
        dq = max(1, min(5, round(random.gauss(p["quality"], 0.6))))
        comment = random.choice(REVIEW_TEXT[fq]) if random.random() < 0.7 else None
        o["review"] = (rev_id, o["id"], fq, dq, comment, T(created))

# ---------------- partner availability / last known location (now)
for oid, pid_ in live_partners.items():
    o = [x for x in orders if x["id"] == oid][0]
    r = REST[o["rid"]]
    t = 0.6 if o["status"] == "PICKED_UP" else 0.0
    lat = r["lat"] + (o["a"]["lat"] - r["lat"]) * t + random.uniform(-0.002, 0.002)
    lon = r["lon"] + (o["a"]["lon"] - r["lon"]) * t + random.uniform(-0.002, 0.002)
    PART[pid_]["row"][8:11] = ["BUSY", ll(lat), ll(lon)]
for p in PART.values():
    if p["status"] == "ACTIVE" and p["row"][8] != "BUSY":
        r = random.choice([x for x in REST.values() if x["city"] == p["city"] and x["status"] == "ACTIVE"])
        p["row"][9:11] = [ll(r["lat"] + random.uniform(-0.012, 0.012)), ll(r["lon"] + random.uniform(-0.012, 0.012))]
        p["row"][8] = "ONLINE" if random.random() < 0.65 else "OFFLINE"

# ---------------- consistency checks (mirror the CHECK constraints and triggers)
for o in orders:
    assert 0 <= o["disc"] <= o["sub"] and o["tax"] >= 0 and o["fee"] >= 0
    assert o["dist"] <= 8, o
    d = o.get("delivery")
    if d:
        if d["picked"] is not None: assert d["picked"] >= d["assigned"]
        if d["delivered"] is not None: assert d["delivered"] >= d["picked"]
    if o.get("review"): assert o["status"] == "DELIVERED"
for p in PART.values():
    assert p["row"][8] == "OFFLINE" or p["status"] == "ACTIVE"
    assert p["row"][5] == "BICYCLE" or (p["row"][6] and p["row"][7])
for c in CPN:
    assert c["used"] <= c["limit"]
# no partner has two overlapping historical deliveries
by_p = defaultdict(list)
for o in orders:
    d = o.get("delivery")
    if d and not o["live"]:
        by_p[d["pid"]].append((d["assigned"], d["delivered"]))
for lst in by_p.values():
    lst.sort()
    for (a1, b1), (a2, b2) in zip(lst, lst[1:]):
        assert a2 >= b1, "overlap"

# ---------------- write SQL
def insert(table, cols, data, chunk=200):
    out = []
    for i in range(0, len(data), chunk):
        vals = ",\n".join("  (" + ", ".join(q(v) for v in row) + ")" for row in data[i:i + chunk])
        out.append(f"INSERT INTO {table} ({', '.join(cols)}) VALUES\n{vals};")
    return "\n".join(out)

for cid, c in CUST.items():
    rows["customer"][cid - 1] = rows["customer"][cid - 1][:6] + (c["pts"],) + rows["customer"][cid - 1][7:]
rows["delivery_partner"] = [p["row"] for p in PART.values()]
rows["orders"] = [(o["id"], o["cid"], o["a"]["no"], o["rid"], o["cp"]["id"] if o["cp"] else None, o["status"],
                   (N if o["live"] else T)(o["when"]), o["sub"], o["disc"], o["tax"], o["fee"], o["comm"],
                   random.choice([None] * 6 + ["Less spicy please", "Please ring the bell once", "No onions",
                                               "Extra chutney", "Leave at the security desk"]))
                  for o in orders]
for o in orders:
    for ln, (iid, qty, price) in enumerate(o["items"], 1):
        rows["order_item"].append((o["id"], ln, iid, qty, price))
    rows["payment"].append(tuple(o["pay"]))
    d = o.get("delivery")
    if d:
        TS = N if o["live"] else T
        rows["delivery"].append((d["id"], o["id"], d["pid"], d["status"], TS(d["assigned"]),
                                 TS(d["picked"]) if d["picked"] is not None else None,
                                 TS(d["delivered"]) if d["delivered"] is not None else None, o["dist"], d["earn"]))
    if o.get("review"):
        rows["review"].append(o["review"])

COLS = {
 "pincode": ["pincode", "city", "state"],
 "admin": ["admin_id", "full_name", "email", "password_hash", "admin_level", "created_at"],
 "restaurant_owner": ["owner_id", "full_name", "email", "phone", "password_hash", "pan_number", "bank_account_no", "status"],
 "customer": ["customer_id", "full_name", "email", "phone", "password_hash", "date_of_birth", "loyalty_points", "status", "created_at"],
 "delivery_partner": ["partner_id", "full_name", "email", "phone", "password_hash", "vehicle_type", "vehicle_number", "license_no",
                      "availability", "cur_lat", "cur_long", "status", "verified_by", "verified_at"],
 "address": ["customer_id", "address_no", "label", "address_line", "pincode", "latitude", "longitude", "is_default"],
 "restaurant": ["restaurant_id", "owner_id", "name", "phone", "address_line", "pincode", "latitude", "longitude", "opening_time",
                "closing_time", "avg_prep_time", "cost_for_two", "commission_pct", "status", "approved_by", "approved_at"],
 "restaurant_cuisine": ["restaurant_id", "cuisine"],
 "menu_item": ["item_id", "restaurant_id", "name", "description", "category", "price", "is_veg", "is_available", "image_url"],
 "coupon": ["coupon_id", "code", "description", "discount_type", "discount_value", "max_discount", "min_order_value",
            "valid_from", "valid_to", "usage_limit", "status", "restaurant_id"],
 "orders": ["order_id", "customer_id", "address_no", "restaurant_id", "coupon_id", "order_status", "placed_at", "subtotal",
            "discount_amount", "tax_amount", "delivery_fee", "commission_amount", "special_instructions"],
 "order_item": ["order_id", "line_no", "item_id", "quantity", "unit_price"],
 "payment": ["payment_id", "order_id", "method", "amount", "payment_status", "transaction_ref", "paid_at"],
 "delivery": ["delivery_id", "order_id", "partner_id", "delivery_status", "assigned_at", "picked_up_at", "delivered_at",
              "distance_km", "partner_earning"],
 "review": ["review_id", "order_id", "food_rating", "delivery_rating", "comment", "created_at"],
}
ORDER = ["pincode", "admin", "restaurant_owner", "customer", "delivery_partner", "address", "restaurant", "restaurant_cuisine",
         "menu_item", "coupon", "orders", "order_item", "payment", "delivery", "review"]
with open(OUT_SQL, "w") as f:
    f.write("-- =====================================================================\n"
            "--  07_seed.sql : sample data (generated by gen_seed.py, do not edit by hand)\n"
            f"--  Every demo account uses the password  {DEMO_PASSWORD}\n"
            "--  Timestamps are relative to the load time so the data always looks recent.\n"
            "-- =====================================================================\n"
            "USE food_delivery;\nSET @today = CURDATE();\nSET @now = NOW();\n\nSTART TRANSACTION;\n\n")
    for t in ORDER:
        f.write(f"-- {t}: {len(rows[t])} rows\n" + insert(t, COLS[t], rows[t]) + "\n\n")
    f.write("COMMIT;\n")

# ---------------- Redis seed consistent with the SQL data
R = []
R.append("# 02_seed.redis : sample real-time data that matches 07_seed.sql")
R.append("# Load with:  grep -v '^#' redis/02_seed.redis | redis-cli")
R.append("FLUSHDB")
for p in PART.values():
    if p["row"][8] in ("ONLINE", "BUSY"):
        R.append(f"GEOADD partners:geo {p['row'][10]} {p['row'][9]} {p['id']}")
        R.append(f"SET partner:{p['id']}:ping {p['row'][8]} EX 900")
for o in orders:
    if not o["live"]:
        continue
    key = f"order:{o['id']}:events"
    steps = ["PLACED", "CONFIRMED", "PREPARING", "READY", "PICKED_UP"]
    for s in steps[: steps.index(o["status"]) + 1]:
        extra = ""
        if s == "CONFIRMED" and o.get("delivery"):
            extra = f" partner_id {o['delivery']['pid']}"
        R.append(f'XADD {key} * status {s}{extra} note "{s.title().replace("_", " ")}"')
    if o["status"] == "PICKED_UP":
        p = PART[o["delivery"]["pid"]]
        r = REST[o["rid"]]
        for t in (0.2, 0.4, 0.6):
            lat = r["lat"] + (o["a"]["lat"] - r["lat"]) * t
            lon = r["lon"] + (o["a"]["lon"] - r["lon"]) * t
            R.append(f"XADD {key} * type location lat {lat:.6f} long {lon:.6f}")
    R.append(f"EXPIRE {key} 86400")
    R.append(f'LPUSH notif:customer:{o["cid"]} "{{\\"order_id\\":{o["id"]},\\"text\\":\\"Order #{o["id"]} is {o["status"].replace("_", " ").lower()}\\"}}"')
    R.append(f"LTRIM notif:customer:{o['cid']} 0 49")
    R.append(f"EXPIRE notif:customer:{o['cid']} 2592000")
# shopping carts for three customers who are browsing right now
for cid in random.sample([c for c in CUST if c not in live_customers and CUST[c]["status"] == "ACTIVE"], 3):
    a = ADDR[cid][0]
    el = [r for r in REST.values() if r["city"] == CUST[cid]["city"] and r["status"] == "ACTIVE"
          and km(r["lat"], r["lon"], a["lat"], a["lon"]) <= 8]
    r = random.choice(el)
    fields = " ".join(f"item:{m['id']} {random.choice([1, 1, 2])}" for m in random.sample(MENU[r["id"]], 2))
    R.append(f"HSET cart:{cid} restaurant_id {r['id']} {fields}")
    R.append(f"EXPIRE cart:{cid} 604800")
# activity log for the admin dashboard
acts = [("admin", 1, "APPROVE_RESTAURANT", "restaurant", 17), ("admin", 2, "VERIFY_PARTNER", "delivery_partner", 22),
        ("admin", 1, "SUSPEND_RESTAURANT", "restaurant", 18), ("admin", 3, "BLOCK_PARTNER", "delivery_partner", 16),
        ("owner", 4, "UPDATE_MENU_PRICE", "menu_item", 34), ("admin", 1, "CREATE_COUPON", "coupon", 3)]
for role, uid, action, ent, eid in acts:
    R.append(f"XADD activity:log MAXLEN ~ 10000 * actor_role {role} actor_id {uid} action {action} entity {ent} entity_id {eid}")
R.append("HSET session:demo-7f3a9c customer_id 7 role customer login_at 2026-11-08T10:15:00+05:30")
R.append("EXPIRE session:demo-7f3a9c 86400")
os.makedirs(os.path.dirname(OUT_REDIS), exist_ok=True)
open(OUT_REDIS, "w").write("\n".join(R) + "\n")

stats = {t: len(rows[t]) for t in ORDER}
stats["live_orders"] = sum(1 for o in orders if o["live"])
stats["delivered"] = sum(1 for o in orders if o["status"] == "DELIVERED")
stats["cancelled"] = sum(1 for o in orders if o["status"] == "CANCELLED")
stats["coupon_orders"] = sum(1 for o in orders if o["cp"])
stats["redis_commands"] = len(R)
json.dump(stats, open(os.path.join(os.path.dirname(__file__), "seed_stats.json"), "w"), indent=1)
print(json.dumps(stats, indent=1))
