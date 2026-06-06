import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router';

export function NavigationProgress() {
  const navigation = useNavigation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (navigation.state === 'loading') {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [navigation.state]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-linear-to-r from-primary via-accent to-primary animate-pulse z-50" />
  );
}
