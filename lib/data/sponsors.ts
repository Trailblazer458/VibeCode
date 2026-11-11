// Advertisers for the prototype: items whose owners pay for placement. Being on this list never changes an item's fit
// score or rank. It only adds a "Sponsored Ad" label where the item already appears, and never on the top pick of a
// list, so the best match always wins on its own merits (see adSlots in lib/engine/plan.ts).
export const SPONSORED = new Set<string>([
  "rk-luxe", // Himalayan Riverbend Spa Resort
  "rk-ashram", // Swarg Ashram Yoga Retreat
  "rk-volvo", // Overnight Volvo from Kashmere Gate
  "rk-a10", // Meditation at Vashishta Gufa cave
  "rk-f1", // Little Buddha Café
  "jp-palace", // Pink City Palace Hotel
  "jp-samode", // Haveli Raj Niwas
  "jp-train", // Ajmer Shatabdi
  "jp-a4", // City Palace & Hawa Mahal walk
  "jp-f1", // Laxmi Mishthan Bhandar
  "ud-resort", // Aravalli Hills Resort & Spa
  "ud-villa", // Aravalli Private Pool Villas
  "ud-redeye", // Early-morning saver flight
  "ud-a7", // Miniature-painting workshop
  "ud-f6", // Lakeside Family Garden Restaurant
  "ms-landour", // Landour Cottage Homestay
  "ms-hostel", // Cloud End Backpackers
  "ms-volvo", // Overnight Volvo to Dehradun + cab
  "ms-a8", // Nag Tibba overnight trek
  "ms-f7", // Sisters' Bazaar Writers' Café
  "vn-hostel", // Ghat Hoppers Hostel
  "vn-ghat", // Assi Ghat Guest House
  "vn-flight", // Direct flight to Varanasi
  "vn-a6", // Meditation at Sarnath Thai temple
  "vn-f7", // Assi Ghat Family Thali House
  "mn-chalet", // Hampta Pines Couple Chalets
  "mn-family", // Snow Valley Family Resort
  "mn-train", // Shatabdi to Chandigarh + cab
  "mn-a1", // Paragliding at Solang
  "mn-f4", // Drifters' Inn Kitchen
  "cb-luxe", // Kosi Riverside Luxury Tents
  "cb-farm", // Dhikuli Farmstay
  "cb-train", // Ranikhet Express to Ramnagar
  "cb-a7", // Kosi river angling (catch & release)
  "cb-f6", // Machan Kids' Pizza Oven
  "am-luxe", // Swarna Courtyard Hotel
  "am-heritage", // Golden Courtyard Haveli
  "am-vb", // Express train to Amritsar
  "am-a4", // Partition Museum
  "am-f1", // Kesar Da Dhaba
  "ks-luxe", // Parvati Valley Boutique Resort
  "ks-workcafe", // Grahan Cowork Cabins
  "ks-hrtc", // HRTC Volvo to Bhuntar + local bus
  "ks-a8", // Himachali cooking session
  "ks-f5", // Riverside Candle Café
  "ag-tajview", // Taj View Grand
  "ag-farm", // Yamuna Farm Retreat
  "ag-vb", // Express train to Agra Cantt
  "ag-a8", // Keetham lake birding & boating
  "ag-f7", // Garden Family Restaurant
  "nt-hostel", // Tallital Trail Hostel
  "nt-pangot", // Pangot Birding Lodge
  "nt-flight", // Flight to Pantnagar + hill cab
  "nt-a4", // Pangot birding morning
  "nt-f1", // Sakley's Restaurant
  "ga-partylane", // Baga Party Lane Hotel
  "ga-surf", // Mandrem Surf & Yoga Camp
  "ga-train", // Rajdhani to Thivim (overnight)
  "ga-a8", // Sunset cruise on the Mandovi
  "ga-f7", // Anjuna Flea Market Food Stalls
]);
