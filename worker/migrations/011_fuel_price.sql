-- Record what the pump actually showed.
--
-- A fuel pump displays gallons to three decimals and a price per gallon; the
-- total is the derived figure. Storing it the other way round — total only —
-- throws away the two numbers a person can read off the display and forces
-- them to do arithmetic at the pump, which is exactly where nobody will.
--
-- `cost` is still written (computed as gallons x price) so generic
-- cost-across-all-stop-kinds queries keep working without special-casing gas.
ALTER TABLE stop ADD COLUMN price_per_gallon REAL;
