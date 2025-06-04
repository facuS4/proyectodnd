import React from "react";
import { Card, CardBody, CardHeader, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Input } from "@heroui/react";
import { Icon } from "@iconify/react";

interface DiceRollerProps {
  onRollComplete?: (value: number, diceType: string, modifier: number, total: number) => void;
}

export const DiceRoller: React.FC<DiceRollerProps> = ({ onRollComplete }) => {
  const [rollResult, setRollResult] = React.useState<{[key: string]: number[]} | null>(null);
  const [rolling, setRolling] = React.useState(false);
  const [rotateX, setRotateX] = React.useState(0);
  const [rotateY, setRotateY] = React.useState(0);
  const [rotateZ, setRotateZ] = React.useState(0);
  const [diceCounts, setDiceCounts] = React.useState<{[key: string]: number}>({
    d4: 0,
    d6: 0,
    d8: 0,
    d10: 0,
    d12: 0,
    d20: 1, // Default to 1d20
    d100: 0
  });
  const [modifier, setModifier] = React.useState("0");
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [animationPhase, setAnimationPhase] = React.useState<'initial' | 'rolling' | 'complete'>('initial');
  const [animatingDice, setAnimatingDice] = React.useState<string[]>([]);
  
  const diceOptions = [
    { value: "d4", label: "D4", sides: 4 },
    { value: "d6", label: "D6", sides: 6 },
    { value: "d8", label: "D8", sides: 8 },
    { value: "d10", label: "D10", sides: 10 },
    { value: "d12", label: "D12", sides: 12 },
    { value: "d20", label: "D20", sides: 20 },
    { value: "d100", label: "D100", sides: 100 },
  ];

  const handleModifierChange = (value: string) => {
    if (value === "" || value === "-" || /^-?\d+$/.test(value)) {
      setModifier(value);
    }
  };

  const updateDiceCount = (diceType: string, increment: boolean) => {
    setDiceCounts(prev => ({
      ...prev,
      [diceType]: increment 
        ? Math.min(10, prev[diceType] + 1) // Max 10 dice
        : Math.max(0, prev[diceType] - 1)  // Min 0 dice
    }));
  };

  const hasSelectedDice = Object.values(diceCounts).some(count => count > 0);

  const animationRef = React.useRef<number | null>(null);
  const startTimeRef = React.useRef<number>(0);
  const rotationValuesRef = React.useRef({
    x: 0,
    y: 0,
    z: 0
  });
  
  // Animation duration in ms
  const ANIMATION_DURATION = 1000;

  const handleRoll = () => {
    if (!hasSelectedDice) return;
    
    setIsAnimating(true);
    setAnimationPhase('rolling');
    setRollResult(null);
    
    // Find all selected dice types to animate
    const selectedDiceTypes = Object.entries(diceCounts)
      .filter(([_, count]) => count > 0)
      .map(([diceType]) => diceType);
    
    setAnimatingDice(selectedDiceTypes);
    
    // Generate random final rotation values (multiple of 360 for smooth landing)
    const finalRotationX = 360 * (2 + Math.floor(Math.random() * 3));
    const finalRotationY = 360 * (2 + Math.floor(Math.random() * 3));
    const finalRotationZ = 360 * (2 + Math.floor(Math.random() * 3));
    
    // Store initial values
    rotationValuesRef.current = {
      x: 0,
      y: 0,
      z: 0
    };
    
    startTimeRef.current = performance.now();
    
    // Start animation loop
    animateDice(finalRotationX, finalRotationY, finalRotationZ);
  };

  const animateDice = (finalX: number, finalY: number, finalZ: number) => {
    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
    
    // Easing function for smooth deceleration (cubic ease-out)
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const easedProgress = easeOut(progress);
    
    // Calculate current rotation values
    rotationValuesRef.current = {
      x: finalX * easedProgress,
      y: finalY * easedProgress,
      z: finalZ * easedProgress
    };
    
    // Update state with new rotation values
    setRotateX(rotationValuesRef.current.x);
    setRotateY(rotationValuesRef.current.y);
    setRotateZ(rotationValuesRef.current.z);
    
    // Continue animation if not complete
    if (progress < 1) {
      animationRef.current = requestAnimationFrame(() => 
        animateDice(finalX, finalY, finalZ)
      );
    } else {
      // Animation complete
      setAnimationPhase('complete');
      
      // Calculate results after animation completes
      const result = calculateResults();
      setRollResult(result);
      
      // Notify parent component if callback exists
      if (onRollComplete) {
        // Get total for all dice
        let totalValue = 0;
        
        Object.entries(result).forEach(([diceType, values]) => {
          if (values && values.length > 0) {
            values.forEach(val => {
              totalValue += val;
            });
          }
        });
        
        // Parse modifier as number, defaulting to 0 if invalid
        const modifierValue = modifier === "" || modifier === "-" ? 0 : parseInt(modifier);
        const finalTotal = totalValue + modifierValue;
        
        // Use the first dice type in animatingDice array instead of selectedDice
        const primaryDiceType = animatingDice.length > 0 ? animatingDice[0] : "mixed";
        
        onRollComplete(totalValue, primaryDiceType, modifierValue, finalTotal);
      }
      
      // Reset animation state after a short delay
      setTimeout(() => {
        setIsAnimating(false);
        setAnimationPhase('initial');
      }, 500);
    }
  };

  // Clean up animation on unmount
  React.useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const calculateResults = () => {
    const results: Record<string, number[]> = {};
    
    Object.entries(diceCounts).forEach(([diceType, count]) => {
      if (count > 0) {
        const diceObj = diceOptions.find(d => d.value === diceType);
        if (diceObj) {
          results[diceType] = Array.from({ length: count }, () => 
            Math.floor(Math.random() * diceObj.sides) + 1
          );
        }
      }
    });
    
    return results;
  };

  const getDiceColor = (diceType: string) => {
    switch (diceType) {
      case "d4": return "#f31260"; // Red for d4
      case "d6": return "#006FEE"; // Blue for d6
      case "d8": return "#17c964"; // Green for d8
      case "d10": return "#f5a524"; // Yellow for d10
      case "d12": return "#7828c8"; // Purple for d12
      case "d100": return "#9353d3"; // Light purple for d100
      default: return "#000000"; // Black for d20
    }
  };

  const renderDiceGrid = () => {
    return (
      <div className="grid grid-cols-2 gap-4 w-full">
        {diceOptions.map((dice) => (
          <div key={dice.value} className="flex flex-col items-center">
            <div className="mb-2 text-sm font-medium">{dice.label}</div>
            <div className="relative">
              <div 
                className="cursor-pointer" 
                onClick={() => updateDiceCount(dice.value, true)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  updateDiceCount(dice.value, false);
                }}
              >
                {renderDiceShape(dice.value)}
              </div>
              <div className="mt-2 flex items-center justify-center">
                <span className="text-center font-medium">
                  {diceCounts[dice.value] > 0 ? `${diceCounts[dice.value]}x` : "0"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDiceShape = (diceType: string) => {
    const color = getDiceColor(diceType);
    const baseStyle = {
      position: "relative" as const,
      width: "60px",
      height: "60px",
      transformStyle: "preserve-3d" as const,
      transform: isAnimating && animatingDice.includes(diceType)
        ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)` 
        : "rotateX(0deg) rotateY(0deg) rotateZ(0deg)",
      boxShadow: diceCounts[diceType] > 0 
        ? "0 4px 12px rgba(0,0,0,0.2)" 
        : "0 2px 6px rgba(0,0,0,0.1)",
      opacity: diceCounts[diceType] > 0 ? 1 : 0.7,
    };
    
    const showResult = !rolling && rollResult && rollResult[diceType] && rollResult[diceType].length > 0;
    
    switch (diceType) {
      case "d4":
        return (
          <div className="flex justify-center items-center">
            <div 
              style={{
                ...baseStyle,
                width: "0",
                height: "0",
                borderLeft: "30px solid transparent",
                borderRight: "30px solid transparent",
                borderBottom: `52px solid ${color}`,
              }}
            >
              {showResult && diceCounts[diceType] === 1 && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-0 text-white font-bold text-sm">
                  {rollResult[diceType][0]}
                </div>
              )}
              {diceCounts[diceType] > 1 && (
                <div className="absolute -top-2 -right-2 bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {diceCounts[diceType]}x
                </div>
              )}
            </div>
          </div>
        );
      
      case "d6":
        return (
          <div className="flex justify-center items-center">
            <div 
              style={{
                ...baseStyle,
                backgroundColor: color,
                borderRadius: "6px",
              }}
            >
              {showResult && diceCounts[diceType] === 1 && (
                <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                  {rollResult[diceType][0]}
                </div>
              )}
              {diceCounts[diceType] > 1 && (
                <div className="absolute -top-2 -right-2 bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {diceCounts[diceType]}x
                </div>
              )}
            </div>
          </div>
        );
      
      case "d8":
        return (
          <div className="flex justify-center items-center">
            <div 
              style={{
                ...baseStyle,
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                backgroundColor: color,
                transform: `${baseStyle.transform} rotateZ(45deg)`,
              }}
            >
              {showResult && diceCounts[diceType] === 1 && (
                <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                  {rollResult[diceType][0]}
                </div>
              )}
              {diceCounts[diceType] > 1 && (
                <div className="absolute -top-2 -right-2 bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {diceCounts[diceType]}x
                </div>
              )}
            </div>
          </div>
        );
      
      case "d10":
        return (
          <div className="flex justify-center items-center">
            <div 
              style={{
                ...baseStyle,
                clipPath: "polygon(50% 0%, 80% 30%, 100% 50%, 80% 70%, 50% 100%, 20% 70%, 0% 50%, 20% 30%)",
                backgroundColor: color,
              }}
            >
              {showResult && diceCounts[diceType] === 1 && (
                <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                  {rollResult[diceType][0]}
                </div>
              )}
              {diceCounts[diceType] > 1 && (
                <div className="absolute -top-2 -right-2 bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {diceCounts[diceType]}x
                </div>
              )}
            </div>
          </div>
        );
      
      case "d12":
        return (
          <div className="flex justify-center items-center">
            <div 
              style={{
                ...baseStyle,
                backgroundColor: color,
                borderRadius: "20px",
                clipPath: "polygon(50% 0%, 80% 10%, 100% 35%, 100% 65%, 80% 90%, 50% 100%, 20% 90%, 0% 65%, 0% 35%, 20% 10%)",
              }}
            >
              {showResult && diceCounts[diceType] === 1 && (
                <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                  {rollResult[diceType][0]}
                </div>
              )}
              {diceCounts[diceType] > 1 && (
                <div className="absolute -top-2 -right-2 bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {diceCounts[diceType]}x
                </div>
              )}
            </div>
          </div>
        );
      
      case "d20":
        return (
          <div className="flex justify-center items-center">
            <div 
              style={{
                ...baseStyle,
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                backgroundColor: color,
              }}
            >
              {showResult && diceCounts[diceType] === 1 && (
                <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                  {rollResult[diceType][0]}
                </div>
              )}
              {diceCounts[diceType] > 1 && (
                <div className="absolute -top-2 -right-2 bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {diceCounts[diceType]}x
                </div>
              )}
            </div>
          </div>
        );
      
      case "d100":
        return (
          <div className="flex justify-center items-center">
            <div className="relative">
              <div 
                style={{
                  ...baseStyle,
                  clipPath: "polygon(50% 0%, 80% 30%, 100% 50%, 80% 70%, 50% 100%, 20% 70%, 0% 50%, 20% 30%)",
                  backgroundColor: color,
                  width: "90px",
                  height: "90px",
                }}
              >
                {showResult && diceCounts[diceType] === 1 && (
                  <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-2xl">
                    {rollResult[diceType][0]}
                  </div>
                )}
                {diceCounts[diceType] > 1 && (
                  <div className="absolute -top-2 -right-2 bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {diceCounts[diceType]}x
                  </div>
                )}
              </div>
              <div 
                style={{
                  position: "absolute",
                  top: "-15px",
                  right: "-15px",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#7828c8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                %
              </div>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="flex justify-center items-center">
            <div 
              style={{
                ...baseStyle,
                backgroundColor: color,
                borderRadius: "50%",
              }}
            >
              {!rolling && rollResult !== null && (
                <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-2xl">
                  {rollResult[0]}
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  const calculateTotal = () => {
    if (!rollResult) return null;
    
    let sum = 0;
    Object.entries(rollResult).forEach(([diceType, results]) => {
      sum += results.reduce((acc, val) => acc + val, 0);
    });
    
    // Parse modifier as number, defaulting to 0 if invalid
    const modifierValue = modifier === "" || modifier === "-" ? 0 : parseInt(modifier);
    return sum + modifierValue;
  };

  const getRollDescription = () => {
    const parts = Object.entries(diceCounts)
      .filter(([_, count]) => count > 0)
      .map(([diceType, count]) => `${count}${diceType}`);
    
    if (parts.length === 0) return "Roll";
    
    const diceText = parts.join(' + ');
    const modifierValue = modifier === "" || modifier === "-" ? 0 : parseInt(modifier);
    
    if (modifierValue === 0) return `Roll ${diceText}`;
    return `Roll ${diceText} ${modifierValue > 0 ? '+' : ''}${modifierValue}`;
  };

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Dice Roller</h2>
      </CardHeader>
      <CardBody className="flex flex-col items-center gap-4">
        {/* Render all dice types in a grid */}
        {renderDiceGrid()}
        
        {/* Modifier input */}
        <div className="w-full flex items-center gap-2">
          <span className="text-sm whitespace-nowrap">Modifier:</span>
          <Input
            type="text"
            value={modifier}
            onValueChange={handleModifierChange}
            placeholder="0"
            size="sm"
            startContent={<span className="text-default-400">{parseInt(modifier || "0") >= 0 ? "+" : ""}</span>}
          />
        </div>
        
        <Button 
          color="primary" 
          fullWidth
          onPress={handleRoll}
          isDisabled={rolling || !hasSelectedDice}
          startContent={<Icon icon="lucide:dice" width={18} />}
        >
          {getRollDescription()}
        </Button>
        
        {rollResult !== null && !rolling && (
          <div className="mt-2 text-center w-full">
            <p className="text-sm text-default-600">Results:</p>
            
            {/* Results by dice type */}
            {Object.entries(rollResult).map(([diceType, results]) => (
              results.length > 0 && (
                <div key={diceType} className="mb-2">
                  <p className="text-xs text-default-500">{diceType}:</p>
                  <div className="flex flex-wrap gap-1 justify-center my-1">
                    {results.map((result, index) => (
                      <span 
                        key={`${diceType}-${index}`} 
                        className="px-2 py-1 bg-content2 rounded-md text-sm font-medium"
                        style={{ borderLeft: `3px solid ${getDiceColor(diceType)}` }}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                </div>
              )
            ))}
            
            {/* Sum of all dice */}
            {Object.values(rollResult).flat().length > 1 && (
              <p className="text-sm mt-1">
                Sum: {Object.values(rollResult).flat().reduce((acc, val) => acc + val, 0)}
              </p>
            )}
            
            {/* Modifier */}
            {modifier !== "0" && modifier !== "" && (
              <p className="text-sm mt-1">
                Modifier: {parseInt(modifier) > 0 ? `+${modifier}` : modifier}
              </p>
            )}
            
            {/* Total */}
            <p className="text-xl font-bold mt-1">
              Total: {calculateTotal()}
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
};