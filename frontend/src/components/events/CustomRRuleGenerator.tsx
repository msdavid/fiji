'use client';

import React, { useState, useEffect } from 'react';
import { RRule, RRuleSet, rrulestr, Weekday, Frequency as RRuleFrequency } from 'rrule';
import { format, parseISO, isValid as isValidDate } from 'date-fns'; 

// Placeholder deepEqual for now - REPLACE WITH A ROBUST ONE from '@/lib/utils' or a library
const deepEqual = (obj1: any, obj2: any): boolean => {
  // Basic check, consider a more robust library for production
  return JSON.stringify(obj1) === JSON.stringify(obj2); 
};


interface CustomRRuleGeneratorProps {
  value: string; 
  onChange: (newRRule: string) => void; 
  eventStartDate: string; 
}

type FrequencyOption = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type EndCondition = 'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES';

interface RRuleOptionsState {
  freq: FrequencyOption;
  interval: number;
  byweekday: number[]; 
  bymonthday: number | null;
  endCondition: EndCondition;
  until: string; 
  count: number | null;
}

const dayMap: { name: string, rruleConst: Weekday, value: number }[] = [
  { name: 'Mon', rruleConst: RRule.MO, value: 0 }, { name: 'Tue', rruleConst: RRule.TU, value: 1 },
  { name: 'Wed', rruleConst: RRule.WE, value: 2 }, { name: 'Thu', rruleConst: RRule.TH, value: 3 },
  { name: 'Fri', rruleConst: RRule.FR, value: 4 }, { name: 'Sat', rruleConst: RRule.SA, value: 5 },
  { name: 'Sun', rruleConst: RRule.SU, value: 6 },
];

const getValidDtStart = (eventStartDateString: string): Date | null => {
  if (!eventStartDateString) return null;
  const parsedDate = parseISO(eventStartDateString); 
  if (isValidDate(parsedDate)) return parsedDate;
  
  const simpleParsedDate = new Date(eventStartDateString);
  if (isValidDate(simpleParsedDate)) return simpleParsedDate;
  
  return null;
};

const rruleFreqMap: { [key: number]: FrequencyOption } = {
  [RRule.DAILY]: 'DAILY', [RRule.WEEKLY]: 'WEEKLY', [RRule.MONTHLY]: 'MONTHLY',
};

const calculateDefaultOptions = (dtStartInput: Date | null): RRuleOptionsState => {
    const dtStart = dtStartInput || new Date(); 
    const isValidDt = dtStartInput && isValidDate(dtStartInput);
    const defaultOpts = {
        freq: 'WEEKLY' as FrequencyOption, 
        interval: 1,
        byweekday: isValidDt ? [dtStart.getDay() === 0 ? 6 : dtStart.getDay() -1] : [], 
        bymonthday: isValidDt ? dtStart.getDate() : null,
        endCondition: 'NEVER' as EndCondition,
        until: '',
        count: null,
    };
    return defaultOpts;
};

const CustomRRuleGenerator: React.FC<CustomRRuleGeneratorProps> = ({
  value,
  onChange,
  eventStartDate,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(() => !!value); 

  const [options, setOptions] = useState<RRuleOptionsState>(() => 
    calculateDefaultOptions(getValidDtStart(eventStartDate))
  );

  useEffect(() => {
    setIsMounted(true);
  }, []); 

  // Effect to parse RRULE value or set defaults based on eventStartDate and current value
  useEffect(() => {
    if (!isMounted) return;

    const currentDtStart = getValidDtStart(eventStartDate);

    if (!currentDtStart) {
        if (!value) { 
            const defaultOpts = calculateDefaultOptions(null);
            if (!deepEqual(options, defaultOpts)) setOptions(defaultOpts);
            if (recurrenceEnabled) setRecurrenceEnabled(false);
        }
        return; 
    }

    if (value) { 
      let successfullyParsed = false;
      let newOptionsState: RRuleOptionsState | null = null;
      try {
        const ruleInput = rrulestr(value, { unfold: true, dtstart: currentDtStart });
        let parsedRRuleOpts: RRule.Options | null = null;

        if (ruleInput instanceof RRule) parsedRRuleOpts = ruleInput.options;
        else if (ruleInput instanceof RRuleSet) {
          const rrules = ruleInput.rrules();
          if (rrules.length > 0) parsedRRuleOpts = rrules[0].options;
        }
        
        if (parsedRRuleOpts) {
          const freqOption = rruleFreqMap[parsedRRuleOpts.freq as RRuleFrequency] || 'WEEKLY';
          const parsedUntil = parsedRRuleOpts.until ? new Date(parsedRRuleOpts.until) : null;
          let byweekdayNumbers: number[] = [];
          if (parsedRRuleOpts.byweekday) {
            if (Array.isArray(parsedRRuleOpts.byweekday)) byweekdayNumbers = parsedRRuleOpts.byweekday.map(wd => (typeof wd === 'number' ? wd : wd.weekday)).sort((a,b) => a-b);
            else byweekdayNumbers = [typeof parsedRRuleOpts.byweekday === 'number' ? parsedRRuleOpts.byweekday : parsedRRuleOpts.byweekday.weekday];
          }
          let bymonthdayValue: number | null = null;
          if (parsedRRuleOpts.bymonthday) {
            if (Array.isArray(parsedRRuleOpts.bymonthday) && parsedRRuleOpts.bymonthday.length > 0) bymonthdayValue = parsedRRuleOpts.bymonthday[0];
            else if (typeof parsedRRuleOpts.bymonthday === 'number') bymonthdayValue = parsedRRuleOpts.bymonthday;
          }
          newOptionsState = {
            freq: freqOption, interval: parsedRRuleOpts.interval || 1, byweekday: byweekdayNumbers, bymonthday: bymonthdayValue,
            endCondition: parsedRRuleOpts.until ? 'ON_DATE' : parsedRRuleOpts.count ? 'AFTER_OCCURRENCES' : 'NEVER',
            until: parsedUntil && isValidDate(parsedUntil) ? format(parsedUntil, 'yyyy-MM-dd') : '',
            count: parsedRRuleOpts.count || null,
          };
          if (!deepEqual(options, newOptionsState)) { 
            setOptions(newOptionsState);
          }
          successfullyParsed = true;
        }
      } catch (e) { console.error("[CustomRRuleGenerator] Error parsing RRULE string:", e, "Input value:", value); }

      if (recurrenceEnabled !== successfullyParsed) setRecurrenceEnabled(successfullyParsed);
      
      if (!successfullyParsed) {
        const defaultOpts = calculateDefaultOptions(currentDtStart);
        if (!deepEqual(options, defaultOpts)) setOptions(defaultOpts);
        if (value !== "" && currentDtStart) onChange(""); 
      }
    } else { 
      const defaultOpts = calculateDefaultOptions(currentDtStart);
      if (!deepEqual(options, defaultOpts)) setOptions(defaultOpts);
      if (recurrenceEnabled) setRecurrenceEnabled(false); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, eventStartDate, isMounted]); 

  // Effect to generate RRULE string when options change OR recurrenceEnabled changes
  useEffect(() => {
    if (!isMounted) return;

    if (!recurrenceEnabled) { 
      if (value !== "") onChange(""); 
      return;
    }

    const dtStart = getValidDtStart(eventStartDate);
    if (!dtStart) {
        if (value !== "") onChange(""); 
        return;
    }
    
    if ((options.freq === 'WEEKLY' && options.byweekday.length === 0) ||
        (options.freq === 'MONTHLY' && !options.bymonthday) ||
        options.interval < 1) {
      if (value !== "") onChange(""); 
      return; 
    }

    const rruleOptions: Partial<RRule.Options> = { 
      freq: RRule[options.freq] as RRuleFrequency,
      interval: options.interval,
      dtstart: dtStart, 
      wkst: RRule.SU, 
    };

    if (options.freq === 'WEEKLY' && options.byweekday.length > 0) rruleOptions.byweekday = options.byweekday;
    if (options.freq === 'MONTHLY' && options.bymonthday !== null) rruleOptions.bymonthday = options.bymonthday;

    if (options.endCondition === 'ON_DATE' && options.until) {
      const untilDate = parseISO(options.until + "T23:59:59Z"); 
      if (isValidDate(untilDate)) rruleOptions.until = untilDate;
    } else if (options.endCondition === 'AFTER_OCCURRENCES' && options.count && options.count > 0) {
      rruleOptions.count = options.count;
    }
    
    try {
      const rule = new RRule(rruleOptions as RRule.Options); 
      const newRuleString = rule.toString();
      if (newRuleString !== value) {
        // Check if re-parsing newRuleString results in the same options
        // to prevent loops from minor string formatting differences.
        let reParsedOptsFromNewString: RRuleOptionsState | null = null;
        try {
            const tempRuleInput = rrulestr(newRuleString, { unfold: true, dtstart: dtStart });
            let tempParsedRRuleOpts: RRule.Options | null = null;
            if (tempRuleInput instanceof RRule) tempParsedRRuleOpts = tempRuleInput.options;
            else if (tempRuleInput instanceof RRuleSet) {
                const rrules = tempRuleInput.rrules();
                if (rrules.length > 0) tempParsedRRuleOpts = rrules[0].options;
            }
            if (tempParsedRRuleOpts) {
                const freqOpt = rruleFreqMap[tempParsedRRuleOpts.freq as RRuleFrequency] || 'WEEKLY';
                const pUntil = tempParsedRRuleOpts.until ? new Date(tempParsedRRuleOpts.until) : null;
                let bwday: number[] = [];
                if (tempParsedRRuleOpts.byweekday) {
                    if (Array.isArray(tempParsedRRuleOpts.byweekday)) bwday = tempParsedRRuleOpts.byweekday.map(wd => (typeof wd === 'number' ? wd : wd.weekday)).sort((a,b) => a-b);
                    else bwday = [typeof tempParsedRRuleOpts.byweekday === 'number' ? tempParsedRRuleOpts.byweekday : tempParsedRRuleOpts.byweekday.weekday];
                }
                let bmday: number | null = null;
                if (tempParsedRRuleOpts.bymonthday) {
                    if (Array.isArray(tempParsedRRuleOpts.bymonthday) && tempParsedRRuleOpts.bymonthday.length > 0) bmday = tempParsedRRuleOpts.bymonthday[0];
                    else if (typeof tempParsedRRuleOpts.bymonthday === 'number') bmday = tempParsedRRuleOpts.bymonthday;
                }
                reParsedOptsFromNewString = {
                    freq: freqOpt, interval: tempParsedRRuleOpts.interval || 1, byweekday: bwday, bymonthday: bmday,
                    endCondition: tempParsedRRuleOpts.until ? 'ON_DATE' : tempParsedRRuleOpts.count ? 'AFTER_OCCURRENCES' : 'NEVER',
                    until: pUntil && isValidDate(pUntil) ? format(pUntil, 'yyyy-MM-dd') : '',
                    count: tempParsedRRuleOpts.count || null,
                };
            }
        } catch { /* ignore parsing error of self-generated string */ }

        if (!reParsedOptsFromNewString || !deepEqual(options, reParsedOptsFromNewString)) {
            onChange(newRuleString);
        }
      }
    } catch (e) {
      console.error("[CustomRRuleGenerator] Error generating RRULE string:", e, "Options:", rruleOptions);
      if (value !== "") onChange(""); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, eventStartDate, recurrenceEnabled, isMounted]);

  const handleToggleRecurrence = () => {
    setRecurrenceEnabled(prev => !prev);
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFreq = e.target.value as FrequencyOption;
    const dtStart = getValidDtStart(eventStartDate); 
    setOptions(() => { 
      const freshDefaults = calculateDefaultOptions(dtStart); 
      return {
        ...freshDefaults, 
        freq: newFreq,
        byweekday: newFreq === 'WEEKLY' ? freshDefaults.byweekday : [],
        bymonthday: newFreq === 'MONTHLY' ? freshDefaults.bymonthday : null,
        interval: 1, 
        endCondition: 'NEVER', 
        until: '',
        count: null,
      };
    });
  };
  
  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInterval = parseInt(e.target.value, 10);
    setOptions(prev => ({ ...prev, interval: newInterval >= 1 ? newInterval : 1 }));
  };

  const handleWeekdayToggle = (dayValue: number) => {
    setOptions(prev => {
      const newByWeekday = prev.byweekday.includes(dayValue)
        ? prev.byweekday.filter(d => d !== dayValue) 
        : [...prev.byweekday, dayValue];
      return { ...prev, byweekday: newByWeekday.sort((a,b) => a-b) };
    });
  };

  const handleMonthDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let dayVal = e.target.value;
    if (dayVal === "") { setOptions(prev => ({ ...prev, bymonthday: null })); return; }
    let day = parseInt(dayVal, 10);
    if (isNaN(day)) { setOptions(prev => ({ ...prev, bymonthday: null })); return; }
    if (day < 1) day = 1; if (day > 31) day = 31; 
    setOptions(prev => ({ ...prev, bymonthday: day }));
  };

  const handleEndConditionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOptions(prev => ({ ...prev, endCondition: e.target.value as EndCondition, until: '', count: null }));
  };

  const handleUntilDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOptions(prev => ({ ...prev, until: e.target.value }));
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCount = parseInt(e.target.value, 10);
    setOptions(prev => ({ ...prev, count: newCount > 0 ? newCount : null }));
  };
  
  const inputBaseClass = "mt-1 block w-full px-3 py-2 h-9 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50";
  const labelBaseClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";
  const smallInputClass = `${inputBaseClass} w-20 text-center`;

  if (!isMounted) return null;
  
  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 shadow">
      <div className="flex items-center mb-4">
        <input
          type="checkbox"
          id="recurrenceEnabled"
          checked={recurrenceEnabled}
          onChange={handleToggleRecurrence}
          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-indigo-600 dark:ring-offset-gray-800"
        />
        <label htmlFor="recurrenceEnabled" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Enable Recurrence
        </label>
      </div>

      {recurrenceEnabled && (
        <div className="space-y-4">
          <div className="flex items-end space-x-3">
            <div>
              <label htmlFor="freq" className={labelBaseClass}>Repeats</label>
              <select id="freq" value={options.freq} onChange={handleFrequencyChange} className={inputBaseClass}>
                <option value="DAILY">Daily</option> <option value="WEEKLY">Weekly</option> <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div>
              <label htmlFor="interval" className={labelBaseClass}>Every</label>
              <input type="number" id="interval" value={options.interval} onChange={handleIntervalChange} min="1" className={smallInputClass}/>
            </div>
            <span className="pb-2 text-sm text-gray-700 dark:text-gray-300">
              {options.freq === 'DAILY' ? 'day(s)' : options.freq === 'WEEKLY' ? 'week(s)' : 'month(s)'}
            </span>
          </div>

          {options.freq === 'WEEKLY' && (
            <div>
              <label className={labelBaseClass}>On</label>
              <div className="mt-2 grid grid-cols-4 sm:grid-cols-7 gap-2">
                {dayMap.map(day => (
                  <button type="button" key={day.value} onClick={() => handleWeekdayToggle(day.value)}
                    className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${options.byweekday.includes(day.value)
                        ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                    {day.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {options.freq === 'MONTHLY' && (
            <div>
              <label htmlFor="bymonthday" className={labelBaseClass}>On day</label>
              <input type="number" id="bymonthday" value={options.bymonthday || ''} onChange={handleMonthDayChange} min="1" max="31" className={smallInputClass} placeholder="e.g. 15"/>
            </div>
          )}

          <div>
            <label htmlFor="endCondition" className={labelBaseClass}>Ends</label>
            <div className="flex items-center space-x-3 mt-1">
                <select id="endCondition" value={options.endCondition} onChange={handleEndConditionChange} className={`${inputBaseClass} w-auto`}>
                    <option value="NEVER">Never</option> <option value="ON_DATE">On date</option> <option value="AFTER_OCCURRENCES">After</option>
                </select>
                {options.endCondition === 'ON_DATE' && (
                    <input type="date" id="until" value={options.until} onChange={handleUntilDateChange} className={`${inputBaseClass} w-auto`}/>
                )}
                {options.endCondition === 'AFTER_OCCURRENCES' && (
                    <div className="flex items-center space-x-2">
                        <input type="number" id="count" value={options.count || ''} onChange={handleCountChange} min="1" className={smallInputClass} placeholder="e.g. 10"/>
                        <span className="text-sm text-gray-700 dark:text-gray-300">occurrences</span>
                    </div>
                )}
            </div>
          </div>
          <button type="button"
            onClick={() => { 
                const dtStart = getValidDtStart(eventStartDate);
                setOptions(calculateDefaultOptions(dtStart)); 
            }}
            className="mt-2 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            Reset Recurrence Options
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomRRuleGenerator;